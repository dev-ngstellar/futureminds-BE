# STEP 6.3 — ADMIN DASHBOARD API CONTRACT SPECIFICATION

**Target Application:** `future-minds-foundation`  
**Backend Project:** `ayyapanthangal-marathon-2026-BE`  
**Verification Method:** Verified over live HTTP sockets in Step 6.3  
**Date:** 2026-11-24  
**Status:** FULLY COMPLIANT & CONTRACT-VERIFIED  

---

## 1. Executive Summary

This document specifies the exact, verified API contract for all endpoints consumed by the Future Minds Foundation Admin Dashboard (`future-minds-foundation`). 

Every contract outlined below has been verified against the live running NestJS backend application (`ayyapanthangal-marathon-2026-BE`) with real HTTP requests, active validation pipes, and database queries.

---

## 2. Authentication Contract

### 2.1 Admin Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "admin@futureminds.org",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "status": 200,
    "message": "Login successful",
    "email": "admin@futureminds.org",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }`
  - `400 Bad Request`: `{ "message": ["email must be an email", "password should not be empty"], "error": "Bad Request", "statusCode": 400 }`

### 2.2 Bearer Token Usage on Protected Endpoints
All admin endpoints require the JWT returned in `access_token` to be passed via the `Authorization` HTTP header:
```http
Authorization: Bearer <access_token>
```
If the header is missing, malformed, or expired, the backend returns:
```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

---

## 3. Metrics & Statistics Contracts

### 3.1 Overall Dashboard Stats
- **Endpoint:** `GET /registrations/admin/stats`
- **Access:** `Bearer <access_token>` required
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Stats fetched successfully",
    "data": {
      "totalCount": 154,
      "totalRevenue": 56250
    }
  }
  ```
- **Field Definitions:**
  - `totalCount` (`number`): Count of registrations where `paymentStatus = 'PAID'`.
  - `totalRevenue` (`number`): Sum of `amount` in INR for all registrations with `paymentStatus = 'PAID'`.

### 3.2 Category Breakdown Stats
- **Endpoint:** `GET /registrations/admin/stats/paid-category`
- **Access:** `Bearer <access_token>` required
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Paid category stats fetched successfully",
    "data": [
      {
        "category": "1.5 KM",
        "count": 42
      },
      {
        "category": "3 KM",
        "count": 68
      },
      {
        "category": "5 KM",
        "count": 44
      }
    ]
  }
  ```

---

## 4. Registration Management Contracts

### 4.1 Registrations List & Pagination
- **Endpoint:** `GET /registrations/admin`
- **Access:** `Bearer <access_token>` required
- **Query Parameters:**
  - `page` (`number`, default: `1`): Current page.
  - `limit` (`number`, default: `20`): Page size.
  - `paymentStatus` (`string`, optional): Filter by `'PAID'`, `'PENDING'`, `'CANCELLED'`, `'FAILED'`.
  - `raceCategory` (`string`, optional): Filter by category code (e.g. `'5 KM'`, `'3 KM'`, `'1.5 KM'`).
  - `finalRegistration` (`string`, optional): `'true'` or `'false'`.
  - `search` (`string`, optional): Substring search across `name`, `email`, and `mobileNumber`.
  - `fromDate` (`string`, optional): ISO Date string (e.g. `'2026-11-01'`).
  - `toDate` (`string`, optional): ISO Date string.
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Registrations fetched successfully",
    "data": {
      "items": [
        {
          "id": "c1f7b09e-0123-4567-89ab-cdef01234567",
          "userId": null,
          "name": "Jane Doe",
          "referenceNumber": "MAR27-5K-0012",
          "email": "jane@example.com",
          "gender": "Female",
          "dateOfBirth": "1995-05-15T00:00:00.000Z",
          "age": 31,
          "presentAddress": "100 Security Blvd",
          "mobileNumber": "9876543210",
          "medicalHistory": "None",
          "tshirtSize": "M",
          "raceCategory": "5 KM",
          "state": "Tamil Nadu",
          "city": "Chennai",
          "pincode": "600056",
          "emergencyContactName": "John Doe",
          "emergencyContactMobile": "9876543211",
          "waiverAccepted": true,
          "amount": 400,
          "paymentStatus": "PAID",
          "razorpayOrderId": "order_OkL123456",
          "razorpayPaymentId": "pay_OkL789012",
          "ticketId": "tkt_5k_0012",
          "emailSent": true,
          "finalRegistration": true,
          "createdAt": "2026-11-20T10:30:00.000Z",
          "updatedAt": "2026-11-20T10:32:00.000Z"
        }
      ],
      "pageInfo": {
        "totalResults": 154,
        "pageCount": 8,
        "resultsPerPage": 20,
        "currentPage": 1,
        "totalPages": 8,
        "hasNextPage": true,
        "hasPrevPage": false,
        "nextPage": 2,
        "prevPage": null
      }
    }
  }
  ```

### 4.2 Single Registration Details
- **Endpoint:** `GET /registrations/:id`
- **Access:** `Bearer <access_token>` required
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Registration fetched successfully",
    "data": { ...Registration Object... }
  }
  ```
- **Error Response (`404 Not Found`):**
  ```json
  {
    "statusCode": 404,
    "message": "Registration not found."
  }
  ```

### 4.3 Update Registration (Server-Side Whitelisted)
- **Endpoint:** `PUT /registrations/admin/:id`
- **Access:** `Bearer <access_token>` required
- **Headers:** `Content-Type: application/json`
- **Permitted Fields in Body:**
  ```json
  {
    "name": "Jane Doe Updated",
    "email": "jane.updated@example.com",
    "gender": "Female",
    "dateOfBirth": "1995-05-15",
    "age": 31,
    "presentAddress": "100 Security Blvd Apt 4",
    "state": "Tamil Nadu",
    "city": "Chennai",
    "pincode": "600056",
    "mobileNumber": "9876543210",
    "medicalHistory": "None",
    "tshirtSize": "L",
    "emergencyContactName": "Guardian Name",
    "emergencyContactMobile": "9876543212",
    "waiverAccepted": true
  }
  ```
- **Critical Rejection Rules:**
  1. **Disallowed Fields:** If `amount`, `paymentStatus`, `referenceNumber`, `razorpayOrderId`, `razorpayPaymentId`, `ticketId`, `finalRegistration`, etc., are present in the payload, the backend rejects the entire request with **HTTP 400 Bad Request** (`["property amount should not exist"]`).
  2. **Race Category on PAID:** If `raceCategory` is provided and differs from the existing category on a `PAID` registration, the backend rejects with **HTTP 409 Conflict**:
     ```json
     {
       "statusCode": 409,
       "message": "Race category cannot be changed for paid registrations"
     }
     ```
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Registration updated successfully",
    "data": { ...Updated Registration Entity... }
  }
  ```

### 4.4 Soft-Cancel Registration (Protected)
- **Endpoint:** `DELETE /registrations/admin/:id`
- **Access:** `Bearer <access_token>` required
- **Rejection on PAID Registrations (`409 Conflict`):**
  ```json
  {
    "statusCode": 409,
    "message": "Paid registrations cannot be cancelled through this endpoint. Refunds must be handled separately."
  }
  ```
- **Success on PENDING Registrations (`200 OK`):**
  ```json
  {
    "message": "Registration deleted successfully",
    "data": {
      "id": "c1f7b09e-0123-4567-89ab-cdef01234567",
      "paymentStatus": "CANCELLED",
      ...
    }
  }
  ```
- **Missing Registration (`404 Not Found`):**
  ```json
  {
    "statusCode": 404,
    "message": "Registration not found."
  }
  ```

### 4.5 Export Registrations CSV
- **Endpoint:** `GET /registrations/admin/export/csv`
- **Access:** `Bearer <access_token>` required
- **Query Parameters:** `paymentStatus`, `raceCategory`, `search` (same filters as listing)
- **Success Response (`200 OK`):**
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="marathon_registrations_<timestamp>.csv"`
  - Body: Raw CSV text stream.

---

## 5. Payments Management Contracts

### 5.1 All Payments List
- **Endpoint:** `GET /payment/all-payments`
- **Access:** `Bearer <access_token>` required
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "All payments fetched successfully",
    "data": [
      {
        "id": "p1a2b3c4-0000-0000-0000-000000000000",
        "registrationId": "c1f7b09e-0123-4567-89ab-cdef01234567",
        "razorpayOrderId": "order_OkL123456",
        "razorpayPaymentId": "pay_OkL789012",
        "amount": 400,
        "currency": "INR",
        "status": "PAID",
        "method": "upi",
        "verified": true,
        "createdAt": "2026-11-20T10:31:00.000Z",
        "updatedAt": "2026-11-20T10:32:00.000Z"
      }
    ]
  }
  ```

---

## 6. Frontend Recommendations for `future-minds-foundation`

1. **Authentication Token Storage:**
   The login response returns `{ access_token }`. Store this in `localStorage` under `admin_token` or `access_token` and configure Axios/Fetch interceptor to attach `Authorization: Bearer <token>` on all requests.
2. **Cancellation Safeguard in UI:**
   Disable the cancel button if `registration.paymentStatus === 'PAID'`. If an admin clicks it, catch HTTP 409 and display the backend's error message directly to the user.
3. **Edit Modal Payload Sanitization:**
   Before dispatching `PUT /registrations/admin/:id`, sanitize the payload so that `amount`, `paymentStatus`, `referenceNumber`, `razorpayOrderId`, `razorpayPaymentId`, and `ticketId` are deleted from the request body. If the registration is `PAID`, disable the race category selection dropdown.
4. **CSV Export Download:**
   Trigger the download using `api.get('/registrations/admin/export/csv', { responseType: 'blob' })` to create an object URL and click a temporary `<a>` anchor.
