# STEP 6.2 — BACKEND FINANCIAL SAFETY TEST REPORT

**Project:** `ayyapanthangal-marathon-2026-BE`  
**Test Suite:** `src/test_step6_2_runner.ts`  
**Execution Command:** `npm run test` (or `node dist/src/test_step6_2_runner.js`)  
**Date:** 2026-11-24  
**Status:** ALL 16/16 TESTS PASSED (100% SUCCESS RATE)  

---

## 1. Overview of Test Execution

A comprehensive, automated integration and unit test suite was developed and executed directly against the NestJS application context, Prisma ORM, and PostgreSQL database. The test suite systematically verifies the 15 security and financial safety scenarios mandated by Step 6.2 specifications, plus an automated database teardown verification.

### Execution Summary
- **Total Test Cases:** 16
- **Passed:** 16
- **Failed:** 0
- **Execution Time:** ~7 seconds (build + test execution)
- **Exit Code:** 0

---

## 2. Detailed Scenario-by-Scenario Test Results

### Part 1: Cancellation Protection Tests (`DELETE /registrations/admin/:id`)

#### Test 1: Attempting to cancel a PAID registration returns 409 Conflict
- **Input:** `DELETE /registrations/admin/:id` where registration `paymentStatus = 'PAID'`, `finalRegistration = true`.
- **Expected Result:** Throws `HttpException` with HTTP status `409 CONFLICT` and error message: `"Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately."`.
- **Actual Result:** HTTP 409 Conflict thrown with exact message.
- **Status:** **PASS**
- **Details:** `Status: 409, Message: "Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately."`

#### Test 2: The PAID registration status remains PAID after a failed cancellation attempt
- **Input:** Direct database inspection (`prisma.registration.findUnique`) of the target registration following Test 1.
- **Expected Result:** Database record `paymentStatus` remains strictly `'PAID'`, `finalRegistration` remains `true`.
- **Actual Result:** `paymentStatus === 'PAID'`, `finalRegistration === true`.
- **Status:** **PASS**
- **Details:** `Status: PAID, Final: true`

#### Test 3: Cancelling a PENDING registration succeeds and marks it CANCELLED
- **Input:** `DELETE /registrations/admin/:id` where registration `paymentStatus = 'PENDING'`.
- **Expected Result:** Soft cancellation succeeds; returned entity and database row both reflect `paymentStatus = 'CANCELLED'`.
- **Actual Result:** Soft cancellation executed successfully.
- **Status:** **PASS**
- **Details:** `Service result status: CANCELLED, DB status: CANCELLED`

#### Test 4: Cancelling a non-existent registration returns 404 Not Found
- **Input:** `DELETE /registrations/admin/00000000-0000-0000-0000-000000000000` (non-existent UUID).
- **Expected Result:** Throws `HttpException` with HTTP status `404 NOT_FOUND` and message `"Registration not found."`.
- **Actual Result:** HTTP 404 Not Found thrown.
- **Status:** **PASS**
- **Details:** `Status: 404`

#### Test 5: Concurrency safety: Simulated simultaneous payment finalisation and cancellation attempt
- **Input:** PENDING registration subjected to simultaneous payment finalisation (simulating Razorpay webhook setting `paymentStatus: 'PAID'`) and administrative soft-cancellation.
- **Expected Result:** Concurrency guard guarantees that PAID status wins; cancellation attempt is rejected with HTTP 409 Conflict; final stored status is `PAID`.
- **Actual Result:** Cancellation rejected with HTTP 409; registration remains `PAID`.
- **Status:** **PASS**
- **Details:** `Status: PAID, Error: 409`

---

### Part 2: Amount Protection Tests (`PUT /registrations/admin/:id`)

#### Test 6: Attempting to modify amount via PUT /registrations/admin/:id is prevented
- **Input:** `PUT /registrations/admin/:id` with payload `{ name: 'Attempted Modification', amount: 100 }`.
- **Expected Result:** NestJS `ValidationPipe` configured with `whitelist: true, forbidNonWhitelisted: true` detects forbidden property `amount` and rejects request with HTTP 400 Bad Request.
- **Actual Result:** `ValidationPipe` rejected with HTTP 400 Bad Request (`property amount should not exist`).
- **Status:** **PASS**
- **Details:** `ValidationPipe rejected with status: 400`

#### Test 7: The registration amount remains unchanged after an update attempt
- **Input:** Registration created with server-authoritative amount ₹350. Admin update attempted with bypassed raw payload `{ amount: 9999 }`.
- **Expected Result:** Service mapper sanitization and repository projection discard `amount`; database record remains ₹350.
- **Actual Result:** Stored amount in PostgreSQL remains ₹350.
- **Status:** **PASS**
- **Details:** `Stored amount: 350`

#### Test 8: Permitted fields can be successfully updated on a PAID registration without error
- **Input:** PAID registration updated with permitted participant biographical fields: `{ name: 'Jane Doe Updated', emergencyContactName: 'New Guardian', emergencyContactMobile: '9888877777', city: 'Coimbatore' }`.
- **Expected Result:** Update completes with HTTP 200; permitted fields are updated; financial fields (`amount: 350`, `paymentStatus: 'PAID'`) remain unchanged.
- **Actual Result:** All permitted fields updated; paymentStatus and amount intact.
- **Status:** **PASS**
- **Details:** `Name: "Jane Doe Updated", City: "Coimbatore", Amount: 350, Status: PAID`

---

### Part 3: Race Category Protection Tests (`PUT /registrations/admin/:id`)

#### Test 9: Attempting to change race category on a PAID registration returns 409 Conflict
- **Input:** PAID registration with category `3 KM` updated with payload `{ raceCategory: '5 KM' }`.
- **Expected Result:** Service rejects category change on PAID registration with HTTP 409 Conflict.
- **Actual Result:** HTTP 409 Conflict thrown with message `"Race category cannot be changed for paid registrations"`.
- **Status:** **PASS**
- **Details:** `Status: 409, Message: "Race category cannot be changed for paid registrations"`

#### Test 10: The race category on a PAID registration remains unchanged after a failed category update attempt
- **Input:** Database inspection of target registration following Test 9.
- **Expected Result:** Category remains `3 KM` (or normalized `KM_3`).
- **Actual Result:** Category remains `3 KM`.
- **Status:** **PASS**
- **Details:** `Current raceCategory: 3 KM`

#### Test 11: Updating race category on a PENDING registration succeeds
- **Input:** PENDING registration with category `3 KM` updated with payload `{ raceCategory: '5 KM' }`.
- **Expected Result:** Update completes successfully; database reflects new normalized category `KM_5`.
- **Actual Result:** Database record updated to `KM_5`.
- **Status:** **PASS**
- **Details:** `New raceCategory in DB: KM_5`

#### Test 12: Concurrency safety: Race category change rejected if payment finalises concurrently
- **Input:** PENDING registration undergoing category update while concurrent transaction transitions status to `PAID`.
- **Expected Result:** Category update detects concurrent payment commit, rolls back category modification, and returns HTTP 409 Conflict. Category remains original.
- **Actual Result:** HTTP 409 Conflict returned; category preserved.
- **Status:** **PASS**
- **Details:** `Status: 409, raceCategory preserved: 3 KM`

---

### Part 4: Server-Side Update Whitelist Tests (`PUT /registrations/admin/:id`)

#### Test 13: Admin update cannot modify paymentStatus
- **Input:** Update payload containing `{ paymentStatus: 'PAID' }` on a PENDING registration.
- **Expected Result:** Rejected by `ValidationPipe` with HTTP 400 Bad Request. Bypassed internal calls are sanitized by `RegistrationMapper`; database status remains `PENDING`.
- **Actual Result:** `ValidationPipe` rejected with HTTP 400; database status preserved as `PENDING`.
- **Status:** **PASS**
- **Details:** `Validation error: 400, DB status: PENDING`

#### Test 14: Admin update cannot modify referenceNumber
- **Input:** Update payload containing `{ referenceNumber: 'TAMPERED-REF-007' }` on a registration with reference number `'MAR27-5K-0999'`.
- **Expected Result:** Rejected by `ValidationPipe` with HTTP 400 Bad Request. Database reference number remains `'MAR27-5K-0999'`.
- **Actual Result:** `ValidationPipe` rejected with HTTP 400; database reference number preserved.
- **Status:** **PASS**
- **Details:** `Validation error: 400, DB referenceNumber: MAR27-5K-0999`

#### Test 15: Admin update cannot modify gateway order, payment IDs, or ticketId
- **Input:** Update payload containing `{ razorpayOrderId: 'order_fake_999', razorpayPaymentId: 'pay_fake_999', ticketId: 'tkt_fake_999' }`.
- **Expected Result:** Rejected by `ValidationPipe` with HTTP 400 Bad Request. Database identifiers remain original.
- **Actual Result:** Rejected with HTTP 400; all database identifiers preserved intact.
- **Status:** **PASS**
- **Details:** `Gateway IDs preserved in DB: Order: order_trusted_initial_001, Payment: pay_trusted_initial_001, Ticket: tkt_trusted_initial_001`

---

### Part 5: Database Teardown Verification

#### Test 16: All temporary test records cleaned up safely
- **Input:** Teardown hook querying database for remaining test records starting with prefix `test_safety_`.
- **Expected Result:** Remaining count = 0.
- **Actual Result:** Count = 0. Zero test artifacts or orphan records left in the database.
- **Status:** **PASS**
- **Details:** `Remaining count: 0`

---

## 3. Test Runner Execution Output

```
> marathon-backend@1.0.0 test
> npm run build && node dist/src/test_step6_2_runner.js


> marathon-backend@1.0.0 build
> tsc

================================================================
 STEP 6.2 — BACKEND FINANCIAL SAFETY & PROTECTION TEST SUITE
================================================================


--- PART 1: CANCELLATION SAFETY TESTS (DELETE /registrations/admin/:id) ---
  ✅ TEST 1 PASS: Attempting to cancel a PAID registration returns 409 Conflict (Status: 409, Message: "Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately.")
  ✅ TEST 2 PASS: The PAID registration status remains PAID after failed cancellation attempt (Status: PAID, Final: true)
  ✅ TEST 3 PASS: Cancelling a PENDING registration succeeds and marks it CANCELLED (Service result status: CANCELLED, DB status: CANCELLED)
  ✅ TEST 4 PASS: Cancelling a non-existent registration returns 404 Not Found (Status: 404)
  ✅ TEST 5 PASS: Concurrency safety: Simultaneous payment finalisation and cancellation results in PAID winning (409 Conflict) (Status: PAID, Error: 409)

--- PART 2: AMOUNT PROTECTION TESTS (PUT /registrations/admin/:id) ---
  ✅ TEST 6 PASS: Attempting to modify amount via PUT /registrations/admin/:id is prevented by ValidationPipe (ValidationPipe rejected with status: 400)
  ✅ TEST 7 PASS: The registration amount remains unchanged (350) after an update attempt that included a modified amount (Stored amount: 350)
  ✅ TEST 8 PASS: Permitted fields (name, emergency contact, city) successfully updated on PAID registration without error (Name: "Jane Doe Updated", City: "Coimbatore", Amount: 350, Status: PAID)

--- PART 3: RACE CATEGORY PROTECTION TESTS (PUT /registrations/admin/:id) ---
  ✅ TEST 9 PASS: Attempting to change race category on a PAID registration returns 409 Conflict (Status: 409, Message: "Race category cannot be changed for paid registrations")
  ✅ TEST 10 PASS: The race category on a PAID registration remains unchanged after a failed category update attempt (Current raceCategory: 3 KM)
  ✅ TEST 11 PASS: Updating race category on a PENDING registration succeeds (New raceCategory in DB: KM_5)
  ✅ TEST 12 PASS: Concurrency safety: Race category change rejected (409 Conflict) if payment finalises concurrently (Status: 409, raceCategory preserved: 3 KM)

--- PART 4: SERVER-SIDE UPDATE WHITELIST TESTS (PUT /registrations/admin/:id) ---
  ✅ TEST 13 PASS: Admin update cannot modify paymentStatus (ValidationPipe 400 and DB preserved as PENDING) (Validation error: 400, DB status: PENDING)
  ✅ TEST 14 PASS: Admin update cannot modify referenceNumber (ValidationPipe 400 and DB preserved as MAR27-5K-0999) (Validation error: 400, DB referenceNumber: MAR27-5K-0999)
  ✅ TEST 15 PASS: Admin update cannot modify gateway order, payment IDs, or ticketId (ValidationPipe 400 and DB preserved) (Gateway IDs preserved in DB: Order: order_trusted_initial_001, Payment: pay_trusted_initial_001, Ticket: tkt_trusted_initial_001)

--- CLEANUP & TEARDOWN ---
  ✅ TEST 16 PASS: All temporary test records cleaned up safely (Remaining count: 0)

================================================================
 SUMMARY: 16/16 TESTS PASSED
================================================================
```
