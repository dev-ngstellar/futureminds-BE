# STEP 6.3 — ACTUAL RUNTIME API ROUTE MATRIX

**Project:** `ayyapanthangal-marathon-2026-BE`  
**Framework:** NestJS 11 + Express 5  
**Discovery Mechanism:** Runtime Express Routing Stack Inspection (`app.getHttpAdapter().getInstance().router.stack`)  
**Date:** 2026-11-24  
**Total Active Routes:** 29  

---

## 1. Overview of Runtime Route Discovery

This matrix documents all 29 HTTP routes registered in the actual running NestJS application. Every endpoint has been verified via runtime route introspection and live HTTP probing.

---

## 2. Complete Runtime Route Inventory

| # | HTTP Method | Route Path | Controller | Guard / Auth | Request DTO / Query | Response Structure | Purpose |
|:---:|:---:|:---|:---|:---:|:---|:---|:---|
| 1 | `GET` | `/` | `AppController` | None (Public) | None | `{ status, message, timestamp, version }` | System root health ping |
| 2 | `GET` | `/health` | `AppController` | None (Public) | None | `{ status, uptime, timestamp }` | System uptime & health check |
| 3 | `GET` | `/marathon/config` | `AppController` | None (Public) | None | `{ status, data: { edition, title, organizer, eventDate, venue, categories: [...] } }` | Dynamic event configuration & pricing |
| 4 | `POST` | `/registrations` | `RegistrationController` | None (Public) | `RegistrationDto` | `{ message, data: Registration }` | Public participant registration |
| 5 | `GET` | `/registrations/pass/:id` | `RegistrationController` | None (Public) | `:id` (UUID param) | `{ message, data: SanitizedPass }` | Public participant pass (sanitized PII) |
| 6 | `GET` | `/registrations/admin/stats` | `RegistrationController` | `JwtAuthGuard` (Bearer) | None | `{ message, data: { totalCount, totalRevenue } }` | Admin dashboard high-level KPIs |
| 7 | `GET` | `/registrations/admin/stats/paid-category` | `RegistrationController` | `JwtAuthGuard` (Bearer) | None | `{ message, data: [ { category, count } ] }` | Admin paid registrations by category |
| 8 | `GET` | `/registrations/admin/export/csv` | `RegistrationController` | `JwtAuthGuard` (Bearer) | `paymentStatus`, `raceCategory`, `search` | Stream: `text/csv; charset=utf-8` | Admin registrations CSV export |
| 9 | `GET` | `/registrations/admin` | `RegistrationController` | `JwtAuthGuard` (Bearer) | `paymentStatus`, `raceCategory`, `finalRegistration`, `state`, `city`, `search`, `fromDate`, `toDate`, `page`, `limit` | `{ message, data: { items: [...], pageInfo: {...} } }` | Admin registrations list with pagination & filters |
| 10 | `GET` | `/registrations/:id` | `RegistrationController` | `JwtAuthGuard` (Bearer) | `:id` (UUID param) | `{ message, data: Registration }` | Admin get single registration details |
| 11 | `PUT` | `/registrations/admin/:id` | `RegistrationController` | `JwtAuthGuard` (Bearer) | `UpdateRegistrationDto` | `{ message, data: Registration }` | Admin update participant details (financial fields whitelisted) |
| 12 | `DELETE` | `/registrations/admin/:id` | `RegistrationController` | `JwtAuthGuard` (Bearer) | `:id` (UUID param) | `{ message, data: Registration }` | Admin soft-cancellation (rejection with 409 for PAID) |
| 13 | `POST` | `/auth/login` | `AuthController` | None (Public) | `LoginDto` (`email`, `password`) | `{ status: 200, message, email, access_token }` | Admin login & JWT token generation |
| 14 | `POST` | `/auth/register` | `AuthController` | `JwtAuthGuard` (Bearer) | `RegisterAdminDto` | `{ message, id }` | Create new administrative user |
| 15 | `POST` | `/payment/order` | `PaymentController` | None (Public) | `CreateOrderDto` (`registrationId`) | `{ message, data: { orderId, amount, currency, ... } }` | Create Razorpay payment order |
| 16 | `POST` | `/payment/verify` | `PaymentController` | None (Public) | `VerifyPaymentDto` (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `registrationId`) | `{ message, data: { success, referenceNumber, newlyFinalized } }` | Client payment verification & finalization |
| 17 | `GET` | `/payment/all-payments` | `PaymentController` | `JwtAuthGuard` (Bearer) | None | `{ message, data: [ Payment, ... ] }` | Admin list all payment transactions |
| 18 | `GET` | `/payment/payment-status/:registrationId` | `PaymentController` | None (Public) | `:registrationId` (UUID) | `{ message, data: { status, amount, currency, method, verified, createdAt } }` | Public payment status check (signature sanitized) |
| 19 | `GET` | `/payment/razorpay/orders` | `RazorpayController` | `JwtAuthGuard` (Bearer) | `page`, `size` | `{ message, pagination: {...}, data: [...] }` | Direct gateway order audit history |
| 20 | `GET` | `/payment/razorpay/payment-history` | `RazorpayController` | `JwtAuthGuard` (Bearer) | `page`, `size` | `{ message, pagination: {...}, data: [...] }` | Direct gateway payment audit history |
| 21 | `POST` | `/api/payment/webhook` | `PaymentWebhookController` | Signature Verified | Raw Body (`order.paid`, `payment.failed`) | `{ status: 'ok' }` | Razorpay webhook endpoint (primary) |
| 22 | `POST` | `/api/payment/webhook/verify-signature` | `PaymentWebhookController` | None (Debug) | Raw Body + Signature | `{ valid: boolean }` | Signature verification debug helper |
| 23 | `POST` | `/api/payment/webhoook` | `PaymentWebhookController` | Signature Verified | Raw Body | `{ status: 'ok' }` | Razorpay webhook endpoint (spelling alias) |
| 24 | `POST` | `/api/payment/webhoook/verify-signature` | `PaymentWebhookController` | None (Debug) | Raw Body + Signature | `{ valid: boolean }` | Signature verification debug helper |
| 25 | `POST` | `/payment/webhook` | `PaymentWebhookController` | Signature Verified | Raw Body | `{ status: 'ok' }` | Razorpay webhook endpoint (short alias) |
| 26 | `POST` | `/payment/webhook/verify-signature` | `PaymentWebhookController` | None (Debug) | Raw Body + Signature | `{ valid: boolean }` | Signature verification debug helper |
| 27 | `GET` | `/webhooks` | `WebhookController` | `JwtAuthGuard` (Bearer) | None | `{ message, count, data: [...] }` | Admin audit list of received webhooks |
| 28 | `GET` | `/webhooks/order/:orderId` | `WebhookController` | `JwtAuthGuard` (Bearer) | `:orderId` | `{ message, count, data: [...] }` | Admin audit webhooks by Razorpay Order ID |
| 29 | `GET` | `/webhooks/payment/:paymentId` | `WebhookController` | `JwtAuthGuard` (Bearer) | `:paymentId` | `{ message, data: [...] }` | Admin audit webhooks by Razorpay Payment ID |

---

## 3. Route Categorization Summary

### 3.1 Public Client Routes (7 Routes)
- `GET /` — System info
- `GET /health` — Health check
- `GET /marathon/config` — Public event & category config
- `POST /registrations` — Registration creation
- `GET /registrations/pass/:id` — Public pass inspection
- `POST /payment/order` — Order creation
- `POST /payment/verify` — Client signature verification
- `GET /payment/payment-status/:registrationId` — Public payment status lookup

### 3.2 Administrative Protected Routes (16 Routes)
All require header `Authorization: Bearer <access_token>`:
- `POST /auth/register` — Admin creation
- `GET /registrations/admin/stats` — Overall metrics
- `GET /registrations/admin/stats/paid-category` — Category breakdown metrics
- `GET /registrations/admin` — Registration list & pagination
- `GET /registrations/admin/export/csv` — CSV export
- `GET /registrations/:id` — Single registration detail
- `PUT /registrations/admin/:id` — Update registration (whitelisted)
- `DELETE /registrations/admin/:id` — Cancel registration (protected for PAID)
- `GET /payment/all-payments` — All payments
- `GET /payment/razorpay/orders` — Gateway orders
- `GET /payment/razorpay/payment-history` — Gateway payments
- `GET /webhooks` — Webhook audit logs
- `GET /webhooks/order/:orderId` — Order webhook audit
- `GET /webhooks/payment/:paymentId` — Payment webhook audit

### 3.3 Gateway Webhook Routes (6 Routes)
All require Razorpay HMAC-SHA256 signature validation via header `x-razorpay-signature`:
- `POST /api/payment/webhook` (and `/verify-signature`)
- `POST /api/payment/webhoook` (and `/verify-signature`)
- `POST /payment/webhook` (and `/verify-signature`)

---

## 4. Key Takeaways for Frontend Developers

1. **Registrations Listing Path:** The administrative list endpoint is `GET /registrations/admin` (not `/registrations/admin/all`).
2. **Registration Update Path:** The administrative update endpoint is `PUT /registrations/admin/:id` (not `PUT /registrations/:id`).
3. **Registration Cancellation Path:** The administrative soft-cancellation endpoint is `DELETE /registrations/admin/:id` (not `DELETE /registrations/:id`).
4. **Login Endpoint:** The authentication endpoint is `POST /auth/login`, returning `{ access_token }`.
