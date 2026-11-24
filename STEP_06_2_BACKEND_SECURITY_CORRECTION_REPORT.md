# STEP 6.2 — BACKEND FINANCIAL SAFETY & SECURITY CORRECTION REPORT

**Project:** `ayyapanthangal-marathon-2026-BE`  
**Date:** 2026-11-24  
**Author:** Antigravity / Engineering Team  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary & Authorization Scope

Under explicit authorization for **STEP 6.2 — BACKEND FINANCIAL SAFETY CORRECTION**, the backend engineering team implemented server-side financial and data-integrity protections in `ayyapanthangal-marathon-2026-BE`. 

These changes resolve critical security vulnerabilities identified during the Step 6.1 Admin Dashboard Audit:
1. **Unrestricted Cancellation of Paid Registrations:** Prevented soft-cancelling registrations whose payment has been successfully captured.
2. **Arbitrary Amount Tampering via Admin Update:** Eliminated the vulnerability where an administrative update could mutate the stored registration `amount`.
3. **Post-Payment Category Modifications:** Prevented altering the race category of registrations once payment is confirmed, while preserving the ability to update participant biographical details.
4. **Server-Side Whitelisting:** Enforced a strict server-side whitelist for registration updates, prohibiting modifications to financial statuses, reference numbers, and payment gateway audit identifiers.

All changes were implemented strictly in the backend source code (`ayyapanthangal-marathon-2026-BE`). No modifications were made to the Prisma schema, database migrations were neither created nor required, and no changes were made to client applications (`future-minds-foundation` and `ayyapanthangal-marathon-2026-FE`).

---

## 2. Detailed Technical Implementations

### 2.1 Task 1: Protected Cancellation Architecture (`DELETE /registrations/admin/:id`)

#### Vulnerability Prior to Correction
Previously, `deleteRegistration` in `RegistrationService` performed a non-conditional update:
```typescript
// Legacy implementation:
return await this.registrationRepository.update(id, {
    paymentStatus: 'CANCELLED',
});
```
This allowed administrators (or compromised tokens) to mark `PAID` registrations as `CANCELLED`, creating accounting discrepancies where payments were collected in Razorpay but registration statuses showed cancelled without an official refund record.

#### Hardened Implementation
We introduced an atomic, concurrency-safe repository method `cancelRegistrationAtomic(id: string)`:
```typescript
async cancelRegistrationAtomic(id: string): Promise<{
    status: 'NOT_FOUND' | 'PAID' | 'CANCELLED';
    registration?: Registration;
}> {
    return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.registration.findUnique({ where: { id } });
        if (!existing) return { status: 'NOT_FOUND' };
        if (existing.paymentStatus === 'PAID') {
            return { status: 'PAID', registration: EntityMapper.toEntity(Registration, existing) };
        }

        // Atomic conditional update ensuring paymentStatus is not PAID
        const updateResult = await tx.registration.updateMany({
            where: { id, paymentStatus: { not: 'PAID' } },
            data: { paymentStatus: 'CANCELLED' },
        });

        if (updateResult.count === 0) {
            const recheck = await tx.registration.findUnique({ where: { id } });
            if (recheck?.paymentStatus === 'PAID') {
                return { status: 'PAID', registration: EntityMapper.toEntity(Registration, recheck) };
            }
        }

        const updated = await tx.registration.findUnique({ where: { id } });
        return { status: 'CANCELLED', registration: EntityMapper.toEntity(Registration, updated) };
    });
}
```

In `RegistrationService`:
```typescript
if (result.status === 'NOT_FOUND') {
    throw new HttpException(ErrorMessages[ErrorCode.REGISTRATION_NOT_FOUND], HttpStatus.NOT_FOUND);
}
if (result.status === 'PAID') {
    throw new HttpException(
        'Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately.',
        HttpStatus.CONFLICT,
    );
}
return result.registration;
```

#### Guarantees:
- **PAID Registrations:** Immediately rejected with **HTTP 409 Conflict**. No state change occurs.
- **PENDING Registrations:** Soft-cancelled (`paymentStatus: 'CANCELLED'`). Payment history rows in the database are preserved.
- **Missing Registrations:** Returns **HTTP 404 Not Found**.
- **No Refund Processing:** The backend explicitly rejects cancellations without claiming or triggering refunds.

---

### 2.2 Task 2 & Task 4: Server-Side Update Whitelist & Amount Protection (`PUT /registrations/admin/:id`)

#### Vulnerability Prior to Correction
`PUT /registrations/admin/:id` utilized `RegistrationDto`, which declared `amount?: number`. Furthermore, `RegistrationMapper.applyUpdate` directly wrote `dto.amount` into the entity if present:
```typescript
// Legacy mapper flaw:
if (dto.amount !== undefined) updated.amount = dto.amount;
```

#### Hardened Implementation
We established a three-layer defense:

1. **Dedicated DTO (`UpdateRegistrationDto`):**
   Created `src/registration/dto/update-registration.dto.ts`. All financial and system fields (`amount`, `paymentStatus`, `referenceNumber`, `razorpayOrderId`, `razorpayPaymentId`, `ticketId`, `userId`, `finalRegistration`, `emailSent`) are completely omitted from the class.
   Because `main.ts` enforces `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, any incoming HTTP request containing `amount` or unauthorized properties is immediately rejected at the HTTP transport level with **HTTP 400 Bad Request** (`property amount should not exist`).

2. **Mapper Sanitization (`RegistrationMapper.applyUpdate`):**
   Removed `dto.amount` assignment. Explicitly hardwired preservation of existing financial and system fields:
   ```typescript
   // System and financial fields are strictly preserved from existing:
   updated.amount = existing.amount;
   updated.paymentStatus = existing.paymentStatus;
   updated.referenceNumber = existing.referenceNumber;
   updated.razorpayOrderId = existing.razorpayOrderId;
   updated.razorpayPaymentId = existing.razorpayPaymentId;
   updated.ticketId = existing.ticketId;
   updated.finalRegistration = existing.finalRegistration;
   updated.emailSent = existing.emailSent;
   updated.userId = existing.userId;
   ```

3. **Prisma Update Projection (`updateRegistrationAdminAtomic`):**
   The database query explicitly specifies only permitted column updates (`name`, `email`, `gender`, `dateOfBirth`, `age`, `presentAddress`, `state`, `city`, `pincode`, `mobileNumber`, `medicalHistory`, `tshirtSize`, `emergencyContactName`, `emergencyContactMobile`, `waiverAccepted`). `amount` is never passed to Prisma `update`.

---

### 2.3 Task 3: Race Category Modification Protection (`PUT /registrations/admin/:id`)

#### Hardened Implementation
Changing race categories after payment alters the event roster, pricing tier, and timing chip allocation.

In `updateRegistrationAdminAtomic`:
1. **Category Normalization:** Categories (`5 KM`, `5KM`, `KM_5`) are normalized to standard keys (`KM_5`, `KM_3`, `KM_1_5`).
2. **PAID Status Verification:**
   ```typescript
   if (data.raceCategory !== undefined) {
       const normNew = RegistrationMapper.normalizeRaceCategory(data.raceCategory);
       const normExisting = RegistrationMapper.normalizeRaceCategory(existing.raceCategory);

       if (normNew !== normExisting && existing.paymentStatus === 'PAID') {
           throw new HttpException(
               'Race category cannot be changed for paid registrations',
               HttpStatus.CONFLICT,
           );
       }
   }
   ```
3. **Biographical Updates on PAID Registrations:** If `raceCategory` is omitted or unchanged, administrators CAN successfully update participant biographical details (e.g. `name`, `city`, `emergencyContactName`, `emergencyContactMobile`) on `PAID` registrations without triggering a conflict.
4. **Category Modification on Unpaid Registrations:** If `paymentStatus === 'PENDING'`, updating the race category is permitted.

---

### 2.4 Concurrency Guarantees

Race conditions can emerge if an administrative action (cancellation or category update) runs concurrently with payment finalization (Razorpay webhook `order.paid` or frontend signature verification).

We resolved this using **ACID Transactions (`this.prisma.$transaction`)** and **atomic conditional updates (`updateMany with paymentStatus: { not: 'PAID' }`)**:
- If an admin clicks "Cancel" while a payment webhook executes, PostgreSQL transaction isolation guarantees serial execution.
- If the payment finalization commits first (`paymentStatus` becomes `PAID`), the cancellation transaction re-checks the record, fails the conditional update, and rejects with **HTTP 409 Conflict**.
- If the cancellation commits first, `paymentStatus` becomes `CANCELLED`. Subsequent payment verification will reject order finalization as designed in Step 4B.

---

## 3. Whitelisted Fields Reference

The following table summarizes the field update policy for `PUT /registrations/admin/:id`:

| Field Name | Allowed for PENDING? | Allowed for PAID? | Rejection Behavior |
|:---|:---:|:---:|:---|
| `name` | Yes | Yes | — |
| `email` | Yes | Yes | — |
| `gender` | Yes | Yes | — |
| `dateOfBirth` | Yes | Yes | — |
| `age` | Yes | Yes | — |
| `presentAddress` | Yes | Yes | — |
| `state` | Yes | Yes | — |
| `city` | Yes | Yes | — |
| `pincode` | Yes | Yes | — |
| `mobileNumber` | Yes | Yes | — |
| `medicalHistory` | Yes | Yes | — |
| `tshirtSize` | Yes | Yes | — |
| `emergencyContactName` | Yes | Yes | — |
| `emergencyContactMobile` | Yes | Yes | — |
| `waiverAccepted` | Yes | Yes | — |
| `raceCategory` | Yes | **NO** | HTTP 409 Conflict if changed |
| `amount` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `paymentStatus` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `referenceNumber` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `razorpayOrderId` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `razorpayPaymentId` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `ticketId` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |
| `finalRegistration` | **NO** | **NO** | HTTP 400 Bad Request / Stripped |

---

## 4. Conclusion

All 4 security correction tasks are fully implemented and verified. The backend guarantees total financial integrity: payments cannot be invalidated by arbitrary cancellations, amounts cannot be altered post-hoc, and category changes cannot desynchronize registration records from their captured transaction amounts.
