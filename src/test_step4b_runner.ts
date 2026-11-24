import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RegistrationService } from './registration/service/registration.service';
import { RegistrationRepository } from './registration/repository/registration.repository';
import { PaymentService } from './payment/service/payment.service';
import { PaymentWebhookService } from './payment/service/payment.webhook.service';
import { PaymentRepository } from './payment/repository/payment.repository';
import { WebhookRepository } from './payment/repository/payment.webhook.repository';
import { MailService } from './mail/mail.service';
import { RaceCategory } from './common/enums/race-category.enum';
import * as crypto from 'crypto';

interface TestResult {
    name: string;
    passed: boolean;
    details?: string;
    error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
    if (condition) {
        results.push({ name, passed: true, details });
        console.log(`  ✅ PASS: ${name}${details ? ` (${details})` : ''}`);
    } else {
        results.push({ name, passed: false, details });
        console.error(`  ❌ FAIL: ${name}${details ? ` (${details})` : ''}`);
    }
}

function makeTestRegData(suffix: string, category: RaceCategory, amount: number, overrides: any = {}) {
    return {
        name: `Test Runner ${suffix}`,
        email: `test_${suffix}@example.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1995-01-01'),
        age: 30,
        presentAddress: '123 Marathon Avenue',
        mobileNumber: `90000000${suffix.padStart(2, '0').slice(-2)}`,
        tshirtSize: 'L',
        raceCategory: category,
        state: 'Tamil Nadu',
        city: 'Chennai',
        pincode: '600056',
        emergencyContactName: 'Emergency Person',
        emergencyContactMobile: '8888888888',
        waiverAccepted: true,
        amount,
        paymentStatus: 'PENDING',
        finalRegistration: false,
        ...overrides,
    };
}

async function runTests() {
    console.log('====================================================');
    console.log('   STEP 4B: PAYMENT & CONCURRENCY VERIFICATION SUITE');
    console.log('====================================================\n');

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

    const prisma = app.get(PrismaService);
    const regService = app.get(RegistrationService);
    const regRepo = app.get(RegistrationRepository);
    const paymentService = app.get(PaymentService);
    const webhookService = app.get(PaymentWebhookService);
    const paymentRepo = app.get(PaymentRepository);
    const webhookRepo = app.get(WebhookRepository);
    const mailService = app.get(MailService);

    // Mock MailService.sendTicketId to track calls safely
    let emailDispatchCount = 0;
    const sentEmails: Array<{ email: string; refNumber: string }> = [];
    mailService.sendTicketId = async (email: string, refNumber: string, amount: string, eventDetails: any) => {
        emailDispatchCount++;
        sentEmails.push({ email, refNumber });
        return { messageId: 'mock-mail-id-' + Date.now() } as any;
    };

    // Mock paymentService.razorpay.orders.create to avoid live charges
    let mockOrderCounter = 1000;
    (paymentService as any).razorpay = {
        orders: {
            create: async (params: any) => {
                mockOrderCounter++;
                return {
                    id: `order_test_${mockOrderCounter}`,
                    amount: params.amount,
                    currency: params.currency || 'INR',
                    notes: params.notes || {},
                };
            },
        },
    };

    const cleanTestData = async () => {
        await prisma.webhook.deleteMany({
            where: {
                OR: [
                    { razorpayOrderId: { startsWith: 'order_test_' } },
                    { eventId: { startsWith: 'evt_test_' } },
                ],
            },
        });
        await prisma.payment.deleteMany({
            where: {
                OR: [
                    { razorpayOrderId: { startsWith: 'order_test_' } },
                    { registration: { email: { startsWith: 'test_' } } },
                ],
            },
        });
        await prisma.registration.deleteMany({
            where: { email: { startsWith: 'test_' } },
        });
    };

    try {
        await cleanTestData();

        // =========================================================================
        // TEST SUITE 1: Atomic Reference Number Generation & Category Base Offsets
        // =========================================================================
        console.log('\n--- 1. ATOMIC REFERENCE NUMBER SEQUENCE BASES ---');

        await prisma.$transaction(async (tx) => {
            const ref1_5k = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_1_5);
            assert(ref1_5k === '1101', '1.5 KM base reference number allocation', `Got: ${ref1_5k}, expected: 1101`);

            const ref3k = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_3);
            assert(ref3k === '3101', '3 KM base reference number allocation', `Got: ${ref3k}, expected: 3101`);

            const ref5k = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
            assert(ref5k === '5101', '5 KM base reference number allocation', `Got: ${ref5k}, expected: 5101`);
        });

        // =========================================================================
        // TEST SUITE 2: Numerical Ordering vs Lexicographical Max Sorting
        // =========================================================================
        console.log('\n--- 2. NUMERICAL SEQUENCE ORDERING (5109 -> 5110) ---');

        // Create a record with referenceNumber '5109'
        const reg5109 = await prisma.registration.create({
            data: makeTestRegData('5109', RaceCategory.KM_5, 400, {
                referenceNumber: '5109',
                paymentStatus: 'PAID',
                finalRegistration: true,
            }),
        });

        await prisma.$transaction(async (tx) => {
            const nextRef = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
            assert(nextRef === '5110', 'Numerical order increments past 5109 to 5110', `Got: ${nextRef}, expected: 5110 (proves no string sorting bug)`);
        });

        // Clean up reg5109
        await prisma.registration.delete({ where: { id: reg5109.id } });

        // =========================================================================
        // TEST SUITE 3: Concurrency Safety with PostgreSQL Advisory Locks
        // =========================================================================
        console.log('\n--- 3. CONCURRENT REFERENCE NUMBER ALLOCATION SAFETY ---');

        // Execute 5 simultaneous transactions attempting to allocate for 5 KM
        const concurrentAllocations = await Promise.all([
            prisma.$transaction(async (tx) => {
                const num = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
                await tx.registration.create({
                    data: makeTestRegData('c1', RaceCategory.KM_5, 400, {
                        referenceNumber: num,
                        paymentStatus: 'PAID',
                        finalRegistration: true,
                    }),
                });
                return num;
            }),
            prisma.$transaction(async (tx) => {
                const num = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
                await tx.registration.create({
                    data: makeTestRegData('c2', RaceCategory.KM_5, 400, {
                        referenceNumber: num,
                        paymentStatus: 'PAID',
                        finalRegistration: true,
                    }),
                });
                return num;
            }),
            prisma.$transaction(async (tx) => {
                const num = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
                await tx.registration.create({
                    data: makeTestRegData('c3', RaceCategory.KM_5, 400, {
                        referenceNumber: num,
                        paymentStatus: 'PAID',
                        finalRegistration: true,
                    }),
                });
                return num;
            }),
            prisma.$transaction(async (tx) => {
                const num = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
                await tx.registration.create({
                    data: makeTestRegData('c4', RaceCategory.KM_5, 400, {
                        referenceNumber: num,
                        paymentStatus: 'PAID',
                        finalRegistration: true,
                    }),
                });
                return num;
            }),
            prisma.$transaction(async (tx) => {
                const num = await regRepo.getNextReferenceNumberAtomic(tx, RaceCategory.KM_5);
                await tx.registration.create({
                    data: makeTestRegData('c5', RaceCategory.KM_5, 400, {
                        referenceNumber: num,
                        paymentStatus: 'PAID',
                        finalRegistration: true,
                    }),
                });
                return num;
            }),
        ]);

        const uniqueNums = new Set(concurrentAllocations);
        assert(uniqueNums.size === 5, 'All concurrent reference numbers are distinct (no collision)', `Generated: ${concurrentAllocations.join(', ')}`);

        const sortedNums = [...concurrentAllocations].map(Number).sort((a, b) => a - b);
        const isStrictlySequential = sortedNums.every((val, idx) => idx === 0 || val === sortedNums[idx - 1] + 1);
        assert(isStrictlySequential, 'Concurrent reference numbers form a gapless sequential range', `Sequence: ${sortedNums.join(', ')}`);

        // Clean up concurrent test records
        await cleanTestData();

        // =========================================================================
        // TEST SUITE 4: Secure Payment Order Creation (Server-Authoritative Amount)
        // =========================================================================
        console.log('\n--- 4. SECURE PAYMENT ORDER CREATION ---');

        // Create a fresh pending registration
        const reg4 = await prisma.registration.create({
            data: makeTestRegData('order', RaceCategory.KM_5, 400),
        });

        // 4.1 Non-existent registration ID rejected with 404
        let err404 = false;
        try {
            await paymentService.createOrder('00000000-0000-0000-0000-000000000000');
        } catch (e: any) {
            err404 = e.getStatus?.() === 404 || e.status === 404;
        }
        assert(err404, 'createOrder rejects non-existent registration with 404');

        // 4.2 Valid registration creates order with server-calculated amount
        const orderResult = await paymentService.createOrder(reg4.id);
        assert(Boolean(orderResult.orderId), 'createOrder returns valid orderId', `orderId: ${orderResult.orderId}`);
        assert(orderResult.amount === 40000, 'createOrder uses server-authoritative amount in paise (400 -> 40000)', `amount: ${orderResult.amount}`);

        // Verify Payment record created in DB
        const paymentRow = await prisma.payment.findFirst({
            where: { razorpayOrderId: orderResult.orderId },
        });
        assert(Boolean(paymentRow), 'Payment record created with PENDING status', `status: ${paymentRow?.status}, amount: ${paymentRow?.amount}`);
        assert(paymentRow?.amount === 400, 'Payment record stores exact registration amount (₹400)');

        // 4.3 Cancelled registration rejected with 400
        const regCancelled = await prisma.registration.create({
            data: makeTestRegData('cancelled', RaceCategory.KM_3, 350, {
                paymentStatus: 'CANCELLED',
            }),
        });
        let errCancelled = false;
        try {
            await paymentService.createOrder(regCancelled.id);
        } catch (e: any) {
            errCancelled = e.getStatus?.() === 400 || e.status === 400;
        }
        assert(errCancelled, 'createOrder rejects CANCELLED registration with 400 Bad Request');

        // =========================================================================
        // TEST SUITE 5: HMAC Payment Verification & Idempotent Finalization
        // =========================================================================
        console.log('\n--- 5. HMAC PAYMENT VERIFICATION & FINALIZATION ---');

        const secret = process.env.RAZORPAY_KEY_SECRET as string;
        const testOrderId = orderResult.orderId;
        const testPaymentId = 'pay_test_' + Date.now();

        // 5.1 Invalid signature rejected
        let invalidSigRejected = false;
        try {
            await paymentService.verifyAndFinalizePayment({
                razorpay_order_id: testOrderId,
                razorpay_payment_id: testPaymentId,
                razorpay_signature: 'invalid_signature_hex_digest_xyz123',
                registrationId: reg4.id,
            });
        } catch (e: any) {
            invalidSigRejected = e.getStatus?.() === 400 || e.status === 400;
        }
        assert(invalidSigRejected, 'verifyAndFinalizePayment rejects forged signature with 400');

        // Verify registration is still PENDING after failed signature
        const regStillPending = await prisma.registration.findUnique({ where: { id: reg4.id } });
        assert(regStillPending?.paymentStatus === 'PENDING' && !regStillPending.finalRegistration, 'Registration remains PENDING after invalid signature');

        // 5.2 Mismatched registrationId rejected
        const validSig = crypto
            .createHmac('sha256', secret)
            .update(`${testOrderId}|${testPaymentId}`)
            .digest('hex');

        let mismatchRejected = false;
        try {
            await paymentService.verifyAndFinalizePayment({
                razorpay_order_id: testOrderId,
                razorpay_payment_id: testPaymentId,
                razorpay_signature: validSig,
                registrationId: '00000000-0000-0000-0000-000000000000', // Wrong registration
            });
        } catch (e: any) {
            mismatchRejected = e.getStatus?.() === 400 || e.status === 400;
        }
        assert(mismatchRejected, 'verifyAndFinalizePayment rejects mismatched registrationId with 400');

        // 5.3 Valid signature verifies and finalizes registration
        const initialEmailCount = emailDispatchCount;
        const finalizeResult = await paymentService.verifyAndFinalizePayment({
            razorpay_order_id: testOrderId,
            razorpay_payment_id: testPaymentId,
            razorpay_signature: validSig,
            registrationId: reg4.id,
        });

        assert(finalizeResult.success === true, 'verifyAndFinalizePayment returns success: true');
        assert(finalizeResult.newlyFinalized === true, 'First verification returns newlyFinalized: true');
        assert(Boolean(finalizeResult.referenceNumber), 'Reference number assigned on finalization', `Ref: ${finalizeResult.referenceNumber}`);
        assert(emailDispatchCount === initialEmailCount + 1, 'Confirmation email dispatched exactly once on initial finalization');

        // Verify DB updates
        const updatedReg = await prisma.registration.findUnique({ where: { id: reg4.id } });
        assert(updatedReg?.paymentStatus === 'PAID', 'Registration paymentStatus updated to PAID in DB');
        assert(updatedReg?.finalRegistration === true, 'Registration finalRegistration marked true in DB');
        assert(updatedReg?.referenceNumber === finalizeResult.referenceNumber, 'Registration referenceNumber saved in DB');
        assert(updatedReg?.razorpayPaymentId === testPaymentId, 'Registration razorpayPaymentId saved in DB');

        const updatedPayment = await prisma.payment.findFirst({ where: { razorpayOrderId: testOrderId } });
        assert(updatedPayment?.status === 'PAID' && updatedPayment.verified === true, 'Payment table row updated to status: PAID, verified: true');
        assert(updatedPayment?.razorpayPaymentId === testPaymentId, 'Payment table row stores razorpayPaymentId');
        assert(updatedPayment?.razorpaySignature === validSig, 'Payment table row stores razorpaySignature');

        // =========================================================================
        // TEST SUITE 6: Verification Idempotency (Duplicate Verification Calls)
        // =========================================================================
        console.log('\n--- 6. VERIFICATION IDEMPOTENCY ---');

        const secondEmailCount = emailDispatchCount;
        const duplicateResult = await paymentService.verifyAndFinalizePayment({
            razorpay_order_id: testOrderId,
            razorpay_payment_id: testPaymentId,
            razorpay_signature: validSig,
            registrationId: reg4.id,
        });

        assert(duplicateResult.success === true, 'Duplicate verification returns success: true');
        assert(duplicateResult.newlyFinalized === false, 'Duplicate verification returns newlyFinalized: false');
        assert(duplicateResult.referenceNumber === finalizeResult.referenceNumber, 'Duplicate verification returns identical reference number without incrementing');
        assert(emailDispatchCount === secondEmailCount, 'Confirmation email is NOT resent on duplicate verification (idempotent)');

        // Trying to create order on already PAID registration rejected
        let paidOrderRejected = false;
        try {
            await paymentService.createOrder(reg4.id);
        } catch (e: any) {
            paidOrderRejected = e.getStatus?.() === 400 || e.status === 400;
        }
        assert(paidOrderRejected, 'createOrder rejects already PAID registration with 400 Bad Request');

        // =========================================================================
        // TEST SUITE 7: Webhook Signature, Idempotency, and Failure Handling
        // =========================================================================
        console.log('\n--- 7. WEBHOOK VERIFICATION & RECONCILIATION ---');

        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET as string;

        // 7.1 Webhook signature verification check
        const samplePayload = JSON.stringify({ event: 'order.paid', test: true });
        const validWebhookSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(samplePayload)
            .digest('hex');

        const isSigValid = webhookService.verifyWebhookSignature(samplePayload, validWebhookSig);
        assert(isSigValid === true, 'verifyWebhookSignature approves authentic HMAC signature');

        const isSigInvalid = webhookService.verifyWebhookSignature(samplePayload, 'forged_webhook_signature');
        assert(isSigInvalid === false, 'verifyWebhookSignature rejects invalid webhook signature');

        // 7.2 Webhook finalizes a PENDING order via order.paid
        const regWebhook = await prisma.registration.create({
            data: makeTestRegData('webhook', RaceCategory.KM_3, 350),
        });

        const whOrder = await paymentService.createOrder(regWebhook.id);
        const whPaymentId = 'pay_wh_' + Date.now();
        const whEventId = 'evt_test_' + Date.now();

        const whEventPayload = {
            event: 'order.paid',
            event_id: whEventId,
            payload: {
                order: { entity: { id: whOrder.orderId } },
                payment: {
                    entity: {
                        id: whPaymentId,
                        order_id: whOrder.orderId,
                        method: 'upi',
                        notes: { registrationId: regWebhook.id },
                    },
                },
            },
        };

        const whSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(whEventPayload))
            .digest('hex');

        const emailBeforeWh = emailDispatchCount;
        await webhookService.handleWebhook(whSig, whEventPayload, whEventId);

        const finalizedByWh = await prisma.registration.findUnique({ where: { id: regWebhook.id } });
        assert(finalizedByWh?.paymentStatus === 'PAID', 'Webhook order.paid updates registration to PAID');
        assert(finalizedByWh?.finalRegistration === true, 'Webhook order.paid marks finalRegistration: true');
        assert(Boolean(finalizedByWh?.referenceNumber), 'Webhook order.paid allocates reference number', `Ref: ${finalizedByWh?.referenceNumber}`);
        assert(emailDispatchCount === emailBeforeWh + 1, 'Webhook order.paid dispatches confirmation email');

        // 7.3 Duplicate Webhook Event handled idempotently
        const emailBeforeDupWh = emailDispatchCount;
        await webhookService.handleWebhook(whSig, whEventPayload, whEventId);
        assert(emailDispatchCount === emailBeforeDupWh, 'Duplicate webhook event is skipped idempotently without duplicate email or counter advance');

        // 7.4 Webhook payment.failed event handling
        const regFailed = await prisma.registration.create({
            data: makeTestRegData('failed', RaceCategory.KM_1_5, 350),
        });

        const failedOrder = await paymentService.createOrder(regFailed.id);
        const failEventPayload = {
            event: 'payment.failed',
            event_id: 'evt_fail_' + Date.now(),
            payload: {
                payment: {
                    entity: {
                        id: 'pay_fail_' + Date.now(),
                        order_id: failedOrder.orderId,
                        error_description: 'Payment was declined by issuing bank',
                    },
                },
            },
        };
        const failSig = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(failEventPayload)).digest('hex');

        await webhookService.handleWebhook(failSig, failEventPayload);

        const failedPaymentRow = await prisma.payment.findFirst({ where: { razorpayOrderId: failedOrder.orderId } });
        assert(failedPaymentRow?.status === 'FAILED', 'Webhook payment.failed marks payment status as FAILED');
        assert(failedPaymentRow?.failureReason === 'Payment was declined by issuing bank', 'Webhook payment.failed stores failureReason in payment record');

        // =========================================================================
        // TEST SUITE 8: Soft Cancellation & Audit History Protection
        // =========================================================================
        console.log('\n--- 8. SOFT CANCELLATION & PAYMENT AUDIT PRESERVATION ---');

        // 8.1 Attempting to delete PAID registration throws 409 Conflict
        let paidCancelError: any = null;
        try {
            await regService.deleteRegistration(regWebhook.id);
        } catch (err) {
            paidCancelError = err;
        }
        assert(paidCancelError?.getStatus?.() === 409, 'deleteRegistration rejects PAID registration with 409 Conflict', `Status: ${paidCancelError?.getStatus?.()}`);

        // 8.2 Soft-cancelling a PENDING registration with payment records succeeds
        const regPendingToCancel = await prisma.registration.create({
            data: makeTestRegData('pending_cancel', RaceCategory.KM_3, 350),
        });
        await paymentService.createOrder(regPendingToCancel.id);
        await regService.deleteRegistration(regPendingToCancel.id);

        const cancelledReg = await prisma.registration.findUnique({ where: { id: regPendingToCancel.id } });
        assert(cancelledReg?.paymentStatus === 'CANCELLED', 'deleteRegistration performs soft cancellation on PENDING registration (paymentStatus = CANCELLED)');

        const preservedPayments = await prisma.payment.findMany({ where: { registrationId: regPendingToCancel.id } });
        assert(preservedPayments.length > 0, 'Payment audit rows are PRESERVED and not cascade-deleted from database', `Preserved payments count: ${preservedPayments.length}`);

        // =========================================================================
        // CLEANUP
        // =========================================================================
        console.log('\n--- 9. CLEANUP & TEARDOWN ---');
        await cleanTestData();

        const remainingTestRegs = await prisma.registration.count({ where: { email: { startsWith: 'test_' } } });
        assert(remainingTestRegs === 0, 'All temporary test registrations successfully cleaned up');

        console.log('\n====================================================');
        console.log(`SUMMARY: ${results.filter(r => r.passed).length}/${results.length} TESTS PASSED`);
        console.log('====================================================\n');

        if (results.some(r => !r.passed)) {
            process.exit(1);
        }

    } catch (err: any) {
        console.error('FATAL TEST ERROR:', err);
        process.exit(1);
    } finally {
        await app.close();
    }
}

runTests();
