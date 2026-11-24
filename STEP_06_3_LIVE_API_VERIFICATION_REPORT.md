# STEP 6.3 — BACKEND LIVE API VERIFICATION REPORT

**Project:** `ayyapanthangal-marathon-2026-BE`  
**Execution Type:** Live HTTP Network Socket Execution  
**Test Suite:** `scratch/test_step6_3_live_verifier.js`  
**Date:** 2026-11-24  
**Status:** 28/28 LIVE API CHECKS PASSED (100% OPERATIONAL)  

---

## 1. Executive Summary

As part of **STEP 6.3 — BACKEND LIVE API VERIFICATION**, the backend engineering team verified the Step 6.2 security and financial safety corrections against the live running NestJS backend application (`ayyapanthangal-marathon-2026-BE`) connected to PostgreSQL.

The verification was conducted over actual TCP network sockets (`http://127.0.0.1:5055`), testing the entire NestJS request pipeline: Express 5 routing, global `ValidationPipe` filtering, Passport JWT authentication guards, business services, transactional repositories, and database constraints.

### Core Verification Findings:
1. **Live Server Execution:** The NestJS application bootstrapped cleanly and listened on live HTTP sockets with all 29 runtime endpoints active.
2. **Authentication Enforcement:** All administrative and export endpoints strictly reject unauthenticated requests with **HTTP 401 Unauthorized**.
3. **Step 6.2 Financial Safeguards in Live HTTP:**
   - Attempting to cancel a `PAID` registration via live `DELETE /registrations/admin/:id` returns **HTTP 409 Conflict** with message `"Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately."`.
   - Stored registration status in PostgreSQL remains strictly `PAID`.
   - Soft-cancelling a `PENDING` registration returns **HTTP 200 OK** and updates status to `CANCELLED`.
   - Modifying `amount` via live `PUT /registrations/admin/:id` is rejected with **HTTP 400 Bad Request** by `ValidationPipe` (`property amount should not exist`). Stored amount remains strictly ₹350.
   - Modifying `raceCategory` on a `PAID` registration via live `PUT` returns **HTTP 409 Conflict** (`"Race category cannot be changed for paid registrations"`).
   - Permitted biographical details (`name`, `city`, `emergencyContactName`, `emergencyContactMobile`) on `PAID` registrations update successfully with **HTTP 200 OK**.
4. **Data Isolation & Privacy:** All live tests executed with ephemeral, isolated test records (`test_step63_` prefix). Zero production participant records were queried or altered. All test records and credentials were automatically purged in the teardown phase.

---

## 2. Live HTTP Verification Results (28/28 Passed)

| Category / Task | Check Description | HTTP Method & Path | Expected Result | Actual Live Result | Status |
|:---|:---|:---|:---|:---|:---:|
| **Task 2: Route Discovery** | Discover runtime routes | `Express Router Stack` | Active route list | 29 active routes registered | **PASS** |
| **Task 3: Auth Guard** | Admin stats protection | `GET /registrations/admin/stats` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Category stats protection | `GET /registrations/admin/stats/paid-category` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Registration list protection | `GET /registrations/admin` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | CSV export protection | `GET /registrations/admin/export/csv` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Payments list protection | `GET /payment/all-payments` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Razorpay orders protection | `GET /payment/razorpay/orders` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Razorpay history protection| `GET /payment/razorpay/payment-history` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Webhooks debug protection | `GET /webhooks` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Registration update auth | `PUT /registrations/admin/:id` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 3: Auth Guard** | Registration cancel auth | `DELETE /registrations/admin/:id` | 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| **Task 8: Auth Contract**| Admin login shape | `POST /auth/login` | 200, `access_token` | HTTP 200, valid JWT token | **PASS** |
| **Task 8: Auth Contract**| Bearer token authorization | `Bearer <access_token>` | 200 Authorized | HTTP 200 Authorized | **PASS** |
| **Task 4.1: Cancel Safety**| PAID cancellation block | `DELETE /registrations/admin/:id` | 409 Conflict | HTTP 409 Conflict | **PASS** |
| **Task 4.1: Cancel Safety**| PAID status persistence | Database validation | Status remains `PAID` | DB verified: `PAID` | **PASS** |
| **Task 4.2: Cancel Safety**| PENDING soft-cancellation| `DELETE /registrations/admin/:id` | 200, `CANCELLED` | HTTP 200, DB `CANCELLED` | **PASS** |
| **Task 4.3: Amount Safety**| Amount modification block | `PUT /registrations/admin/:id` | 400 Bad Request | HTTP 400 (`amount should not exist`) | **PASS** |
| **Task 4.3: Amount Safety**| Stored amount persistence | Database validation | Amount remains 350 | DB verified: 350 | **PASS** |
| **Task 4.4: Category Safety**| PAID category change block | `PUT /registrations/admin/:id` | 409 Conflict | HTTP 409 Conflict | **PASS** |
| **Task 4.4: Category Safety**| Category persistence | Database validation | Category remains 3 KM | DB verified: `3 KM` | **PASS** |
| **Task 4.5: Permitted Update**| Permitted biographical edit | `PUT /registrations/admin/:id` | 200 OK | HTTP 200, DB updated | **PASS** |
| **Task 5: Public Config**| Public config contract | `GET /marathon/config` | 200, edition: 3, 3 categories | HTTP 200, valid metadata | **PASS** |
| **Task 6.1: Stats Shape**| Admin stats shape | `GET /registrations/admin/stats` | `{ totalCount, totalRevenue }` | HTTP 200, verified types | **PASS** |
| **Task 6.2: Stats Shape**| Category stats shape | `GET /registrations/admin/stats/paid-category` | `[ { category, count } ]` | HTTP 200, verified array | **PASS** |
| **Task 6.3: List Shape** | Pagination & listing | `GET /registrations/admin?page=1&limit=5` | `{ items, pageInfo }` | HTTP 200, verified pagination | **PASS** |
| **Task 7.1: Payments List**| All payments array | `GET /payment/all-payments` | `{ message, data: [...] }` | HTTP 200, verified array | **PASS** |
| **Task 7.2: CSV Export** | Registrations CSV export | `GET /registrations/admin/export/csv` | 200, `text/csv` | HTTP 200, valid CSV headers | **PASS** |
| **Teardown: Isolation** | Ephemeral records cleanup | Database validation | 0 test records remain | 0 test records in DB | **PASS** |

---

## 3. Detailed Verification Task Analyses

### 3.1 Task 1: Backend Startup & Runtime Environment
- **Command:** `node scratch/test_step6_3_live_verifier.js` executing `NestFactory.create(AppModule)`.
- **Port:** Live HTTP listener bound on port `5055`.
- **Database Connection:** Connected to PostgreSQL via `@prisma/adapter-pg` and Node `pg.Pool`.
- **Startup Integrity:** Clean bootstrap without unhandled rejections, missing dependencies, or circular injection errors.

### 3.2 Task 2: Actual Registered API Routes
Inspection of the runtime Express routing table confirmed **29 active HTTP routes**. No orphaned or phantom routes were discovered. See `STEP_06_3_ACTUAL_API_ROUTE_MATRIX.md` for the complete routing dictionary.

### 3.3 Task 3: Admin Endpoint Protection
Ten distinct administrative endpoints were probed without an `Authorization` header. In all 10 instances, NestJS's `JwtAuthGuard` intercepted the request and returned **HTTP 401 Unauthorized**:
```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

### 3.4 Task 4: Step 6.2 Financial Safeguard Verification in Live HTTP
- **PAID Cancellation Rejection:**
  - Sent `DELETE /registrations/admin/:id` for an isolated registration with `paymentStatus = 'PAID'`.
  - Response: **HTTP 409 Conflict**
    ```json
    {
      "statusCode": 409,
      "message": "Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately."
    }
    ```
  - Direct database query confirmed `paymentStatus` remained strictly `'PAID'`.
- **PENDING Cancellation Execution:**
  - Sent `DELETE /registrations/admin/:id` for a registration with `paymentStatus = 'PENDING'`.
  - Response: **HTTP 200 OK**
  - Direct database query confirmed status transitioned to `'CANCELLED'`.
- **Amount Modification Rejection:**
  - Sent `PUT /registrations/admin/:id` with `{ name: 'Attempted Amount Tamper', amount: 9999 }`.
  - Response: **HTTP 400 Bad Request**
    ```json
    {
      "message": ["property amount should not exist"],
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
  - Database record confirmed stored amount remained strictly ₹350.
- **Race Category Modification on PAID Records:**
  - Sent `PUT /registrations/admin/:id` with `{ raceCategory: '5 KM' }` on a `PAID` registration.
  - Response: **HTTP 409 Conflict**
    ```json
    {
      "statusCode": 409,
      "message": "Race category cannot be changed for paid registrations"
    }
    ```
  - Database confirmed race category remained `3 KM`.
- **Biographical Updates on PAID Records:**
  - Sent `PUT /registrations/admin/:id` with permitted fields: `{ name: 'Verified Updated Participant', city: 'Madurai', emergencyContactName: 'New Contact Person', emergencyContactMobile: '9944332211' }`.
  - Response: **HTTP 200 OK**
  - Database confirmed `name` and `city` updated, while `amount` (₹350) and `paymentStatus` (`PAID`) remained intact.

### 3.5 Task 5: Public Registration Configuration Shape
- Request: `GET /marathon/config`
- Response: **HTTP 200 OK**
```json
{
  "status": "ok",
  "data": {
    "edition": 3,
    "title": "3rd Edition Ayyappanthangal Marathon",
    "organizer": "Future Minds Foundation",
    "eventDate": "2027-02-14T05:30:00.000Z",
    "eventDateFormatted": "Sunday, 14 February 2027",
    "venue": "Ayyappanthangal, Chennai",
    "reportingTime": "05:00 AM",
    "isRegistrationOpen": true,
    "categories": [
      {
        "code": "1.5 KM",
        "display": "1.5 KM Family Fun Run",
        "distance": "1.5 KM",
        "amount": 350
      },
      {
        "code": "3 KM",
        "display": "3 KM Dream Run",
        "distance": "3 KM",
        "amount": 350
      },
      {
        "code": "5 KM",
        "display": "5 KM Challenge",
        "distance": "5 KM",
        "amount": 400
      }
    ]
  }
}
```

### 3.6 Task 6: Admin Statistics & Listing Response Shapes
- `GET /registrations/admin/stats` returned:
  ```json
  {
    "message": "Stats fetched successfully",
    "data": {
      "totalCount": 1,
      "totalRevenue": 350
    }
  }
  ```
- `GET /registrations/admin/stats/paid-category` returned:
  ```json
  {
    "message": "Paid category stats fetched successfully",
    "data": [
      {
        "category": "3 KM",
        "count": 1
      }
    ]
  }
  ```
- `GET /registrations/admin?page=1&limit=5` returned:
  ```json
  {
    "message": "Registrations fetched successfully",
    "data": {
      "items": [...],
      "pageInfo": {
        "totalResults": 2,
        "pageCount": 1,
        "resultsPerPage": 5,
        "currentPage": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false,
        "nextPage": null,
        "prevPage": null
      }
    }
  }
  ```

### 3.7 Task 7: Payment Listing & CSV Export
- `GET /payment/all-payments` returned **HTTP 200 OK** with `{ message: "All payments fetched successfully", data: [...] }`.
- `GET /registrations/admin/export/csv` returned **HTTP 200 OK** with:
  - Header: `Content-Type: text/csv; charset=utf-8`
  - Header: `Content-Disposition: attachment; filename="marathon_registrations_<timestamp>.csv"`
  - Body: Valid RFC 4180 CSV with sanitized formula injection prefixes (`'`) and expected column headers (`"Reference Number"`, `"Name"`, `"Email"`, `"Mobile Number"`, `"Gender"`, `"Date of Birth"`, `"Age"`, `"T-Shirt Size"`, `"Race Category"`, `"Amount"`, `"Payment Status"`, `"Emergency Contact Name"`, `"Emergency Contact Mobile"`, `"Address"`, `"City"`, `"State"`, `"Pincode"`, `"Razorpay Order ID"`).

### 3.8 Task 8: Login Response & Bearer Token Format
- Request: `POST /auth/login` with `{ email, password }`
- Response: **HTTP 200 OK**
```json
{
  "status": 200,
  "message": "Login successful",
  "email": "<admin-email>",
  "access_token": "<jwt-token-string>"
}
```
- Protected Header Format: `Authorization: Bearer <access_token>` successfully authorizes subsequent admin API requests.

---

## 4. Conclusion

The live API verification confirms that the Step 6.2 backend financial corrections are 100% active, functioning correctly in the runtime environment, and fully aligned with the API contract expected by the Future Minds Foundation admin dashboard.
