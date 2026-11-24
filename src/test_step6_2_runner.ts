import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RegistrationService } from './registration/service/registration.service';
import { RegistrationRepository } from './registration/repository/registration.repository';
import { RaceCategory } from './common/enums/race-category.enum';
import { UpdateRegistrationDto } from './registration/dto/update-registration.dto';

interface TestResult {
    number: number;
    name: string;
    passed: boolean;
    details?: string;
    error?: string;
}

const results: TestResult[] = [];

function assertTest(num: number, condition: boolean, name: string, details?: string) {
    if (condition) {
        results.push({ number: num, name, passed: true, details });
        console.log(`  ✅ TEST ${num} PASS: ${name}${details ? ` (${details})` : ''}`);
    } else {
        results.push({ number: num, name, passed: false, details });
        console.error(`  ❌ TEST ${num} FAIL: ${name}${details ? ` (${details})` : ''}`);
    }
}

function makeTestRegData(suffix: string, category: RaceCategory, amount: number, overrides: any = {}) {
    return {
        name: `Safety Test Runner ${suffix}`,
        email: `test_safety_${suffix}_${Date.now()}@example.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1995-05-15'),
        age: 31,
        presentAddress: '100 Security Boulevard',
        mobileNumber: `987654${suffix.padStart(4, '0').slice(-4)}`,
        tshirtSize: 'M',
        raceCategory: category,
        state: 'Tamil Nadu',
        city: 'Chennai',
        pincode: '600056',
        emergencyContactName: 'Safety Guardian',
        emergencyContactMobile: '9111111111',
        waiverAccepted: true,
        amount,
        paymentStatus: 'PENDING',
        finalRegistration: false,
        ...overrides,
    };
}

async function runStep6_2SafetyTests() {
    console.log('================================================================');
    console.log(' STEP 6.2 — BACKEND FINANCIAL SAFETY & PROTECTION TEST SUITE');
    console.log('================================================================\n');

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const prisma = app.get(PrismaService);
    const regService = app.get(RegistrationService);
    const regRepo = app.get(RegistrationRepository);

    const validationPipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });

    const cleanupTestRecords = async () => {
        try {
            await prisma.payment.deleteMany({
                where: { registration: { email: { startsWith: 'test_safety_' } } },
            });
            await prisma.registration.deleteMany({
                where: { email: { startsWith: 'test_safety_' } },
            });
        } catch (e) {
            // Ignore cleanup errors
        }
    };

    try {
        await cleanupTestRecords();

        // =========================================================================
        // PART 1: CANCELLATION PROTECTION (Tests 1 - 5)
        // =========================================================================
        console.log('\n--- PART 1: CANCELLATION SAFETY TESTS (DELETE /registrations/admin/:id) ---');

        // Setup a PAID registration
        const paidReg = await prisma.registration.create({
            data: makeTestRegData('paid_cancel', RaceCategory.KM_3, 350, {
                paymentStatus: 'PAID',
                finalRegistration: true,
                referenceNumber: 'REF-PAID-001',
            }),
        });

        // TEST 1: Attempting to cancel a PAID registration returns 409 Conflict
        let test1Error: any = null;
        try {
            await regService.deleteRegistration(paidReg.id);
        } catch (err) {
            test1Error = err;
        }
        assertTest(
            1,
            test1Error instanceof HttpException && test1Error.getStatus() === 409 &&
            test1Error.message.includes('Paid registrations cannot be cancelled'),
            'Attempting to cancel a PAID registration returns 409 Conflict',
            `Status: ${test1Error?.getStatus?.()}, Message: "${test1Error?.message}"`
        );

        // TEST 2: The PAID registration status remains PAID after a failed cancellation attempt
        const postCancelPaidReg = await prisma.registration.findUnique({ where: { id: paidReg.id } });
        assertTest(
            2,
            postCancelPaidReg?.paymentStatus === 'PAID' && postCancelPaidReg?.finalRegistration === true,
            'The PAID registration status remains PAID after failed cancellation attempt',
            `Status: ${postCancelPaidReg?.paymentStatus}, Final: ${postCancelPaidReg?.finalRegistration}`
        );

        // Setup a PENDING registration
        const pendingReg = await prisma.registration.create({
            data: makeTestRegData('pending_cancel', RaceCategory.KM_3, 350, {
                paymentStatus: 'PENDING',
                finalRegistration: false,
            }),
        });

        // TEST 3: Cancelling a PENDING registration succeeds and marks it CANCELLED
        const cancelResult = await regService.deleteRegistration(pendingReg.id);
        const postCancelPendingReg = await prisma.registration.findUnique({ where: { id: pendingReg.id } });
        assertTest(
            3,
            cancelResult?.paymentStatus === 'CANCELLED' && postCancelPendingReg?.paymentStatus === 'CANCELLED',
            'Cancelling a PENDING registration succeeds and marks it CANCELLED',
            `Service result status: ${cancelResult?.paymentStatus}, DB status: ${postCancelPendingReg?.paymentStatus}`
        );

        // TEST 4: Cancelling a non-existent registration returns 404 Not Found
        let test4Error: any = null;
        try {
            await regService.deleteRegistration('00000000-0000-0000-0000-000000000000');
        } catch (err) {
            test4Error = err;
        }
        assertTest(
            4,
            test4Error instanceof HttpException && test4Error.getStatus() === 404,
            'Cancelling a non-existent registration returns 404 Not Found',
            `Status: ${test4Error?.getStatus?.()}`
        );

        // TEST 5: Concurrency safety: Simulated simultaneous payment finalisation and cancellation attempt
        const concurrentReg = await prisma.registration.create({
            data: makeTestRegData('concur_cancel', RaceCategory.KM_5, 400, {
                paymentStatus: 'PENDING',
                finalRegistration: false,
            }),
        });

        // Simulate concurrent finalization right before/during cancellation
        // Promise 1: marks PAID (webhook/verification completing)
        // Promise 2: admin cancellation attempt
        const finalizePromise = prisma.registration.update({
            where: { id: concurrentReg.id },
            data: { paymentStatus: 'PAID', finalRegistration: true },
        });
        const cancelPromise = finalizePromise.then(() => regService.deleteRegistration(concurrentReg.id));

        let concurrentCancelError: any = null;
        try {
            await cancelPromise;
        } catch (err) {
            concurrentCancelError = err;
        }

        const finalConcurrentRecord = await prisma.registration.findUnique({ where: { id: concurrentReg.id } });
        assertTest(
            5,
            concurrentCancelError instanceof HttpException &&
            concurrentCancelError.getStatus() === 409 &&
            finalConcurrentRecord?.paymentStatus === 'PAID',
            'Concurrency safety: Simultaneous payment finalisation and cancellation results in PAID winning (409 Conflict)',
            `Status: ${finalConcurrentRecord?.paymentStatus}, Error: ${concurrentCancelError?.getStatus?.()}`
        );

        // =========================================================================
        // PART 2: AMOUNT PROTECTION (Tests 6 - 8)
        // =========================================================================
        console.log('\n--- PART 2: AMOUNT PROTECTION TESTS (PUT /registrations/admin/:id) ---');

        const amountTestReg = await prisma.registration.create({
            data: makeTestRegData('amount_protect', RaceCategory.KM_3, 350, {
                paymentStatus: 'PAID',
                finalRegistration: true,
            }),
        });

        // TEST 6: Attempting to modify amount via PUT /registrations/admin/:id is prevented
        // Sub-check A: ValidationPipe rejects 'amount' with 400 Bad Request
        let validationPipeError: any = null;
        try {
            await validationPipe.transform(
                { amount: 100, name: 'Attempted Modification' },
                { type: 'body', metatype: UpdateRegistrationDto },
            );
        } catch (err) {
            validationPipeError = err;
        }

        // Sub-check B: Even if bypassed, service/repository ignores amount
        await regService.updateRegistration(amountTestReg.id, {
            name: 'Amount Tamper Test',
            // @ts-ignore
            amount: 9999,
        } as any);

        assertTest(
            6,
            validationPipeError !== null && validationPipeError?.getStatus?.() === 400,
            'Attempting to modify amount via PUT /registrations/admin/:id is prevented by ValidationPipe',
            `ValidationPipe rejected with status: ${validationPipeError?.getStatus?.()}`
        );

        // TEST 7: The registration amount remains unchanged after an update attempt
        const postAmountReg = await prisma.registration.findUnique({ where: { id: amountTestReg.id } });
        assertTest(
            7,
            postAmountReg?.amount === 350,
            'The registration amount remains unchanged (350) after an update attempt that included a modified amount',
            `Stored amount: ${postAmountReg?.amount}`
        );

        // TEST 8: Permitted fields can be successfully updated on a PAID registration without error
        const permittedUpdateResult = await regService.updateRegistration(amountTestReg.id, {
            name: 'Jane Doe Updated',
            emergencyContactName: 'New Guardian',
            emergencyContactMobile: '9888877777',
            city: 'Coimbatore',
        });
        const postPermittedReg = await prisma.registration.findUnique({ where: { id: amountTestReg.id } });
        assertTest(
            8,
            postPermittedReg?.name === 'Jane Doe Updated' &&
            postPermittedReg?.emergencyContactName === 'New Guardian' &&
            postPermittedReg?.city === 'Coimbatore' &&
            postPermittedReg?.paymentStatus === 'PAID' &&
            postPermittedReg?.amount === 350,
            'Permitted fields (name, emergency contact, city) successfully updated on PAID registration without error',
            `Name: "${postPermittedReg?.name}", City: "${postPermittedReg?.city}", Amount: ${postPermittedReg?.amount}, Status: ${postPermittedReg?.paymentStatus}`
        );

        // =========================================================================
        // PART 3: RACE CATEGORY PROTECTION (Tests 9 - 12)
        // =========================================================================
        console.log('\n--- PART 3: RACE CATEGORY PROTECTION TESTS (PUT /registrations/admin/:id) ---');

        const catPaidReg = await prisma.registration.create({
            data: makeTestRegData('cat_protect', RaceCategory.KM_3, 350, {
                paymentStatus: 'PAID',
                finalRegistration: true,
            }),
        });

        // TEST 9: Attempting to change race category on a PAID registration returns 409 Conflict
        let catChangeError: any = null;
        try {
            await regService.updateRegistration(catPaidReg.id, {
                raceCategory: RaceCategory.KM_5,
            });
        } catch (err) {
            catChangeError = err;
        }
        assertTest(
            9,
            catChangeError instanceof HttpException &&
            catChangeError.getStatus() === 409 &&
            catChangeError.message.includes('Race category cannot be changed for paid registrations'),
            'Attempting to change race category on a PAID registration returns 409 Conflict',
            `Status: ${catChangeError?.getStatus?.()}, Message: "${catChangeError?.message}"`
        );

        // TEST 10: The race category on a PAID registration remains unchanged after a failed category update attempt
        const postCatChangeReg = await prisma.registration.findUnique({ where: { id: catPaidReg.id } });
        assertTest(
            10,
            postCatChangeReg?.raceCategory === 'KM_3' || postCatChangeReg?.raceCategory === '3 KM',
            'The race category on a PAID registration remains unchanged after a failed category update attempt',
            `Current raceCategory: ${postCatChangeReg?.raceCategory}`
        );

        // Setup a PENDING registration for category update
        const catPendingReg = await prisma.registration.create({
            data: makeTestRegData('cat_pending', RaceCategory.KM_3, 350, {
                paymentStatus: 'PENDING',
                finalRegistration: false,
            }),
        });

        // TEST 11: Updating race category on a PENDING registration succeeds
        const updatePendingCatResult = await regService.updateRegistration(catPendingReg.id, {
            raceCategory: RaceCategory.KM_5,
        });
        const postPendingCatReg = await prisma.registration.findUnique({ where: { id: catPendingReg.id } });
        assertTest(
            11,
            postPendingCatReg?.raceCategory === 'KM_5',
            'Updating race category on a PENDING registration succeeds',
            `New raceCategory in DB: ${postPendingCatReg?.raceCategory}`
        );

        // TEST 12: Concurrency safety: Race category change rejected if payment finalises concurrently
        const catConcurrentReg = await prisma.registration.create({
            data: makeTestRegData('cat_concur', RaceCategory.KM_3, 350, {
                paymentStatus: 'PENDING',
                finalRegistration: false,
            }),
        });

        // Simulate payment finalisation occurring right as category update is processed
        await prisma.registration.update({
            where: { id: catConcurrentReg.id },
            data: { paymentStatus: 'PAID', finalRegistration: true },
        });

        let concurrentCatError: any = null;
        try {
            await regService.updateRegistration(catConcurrentReg.id, {
                raceCategory: RaceCategory.KM_5,
            });
        } catch (err) {
            concurrentCatError = err;
        }

        const postConcurrentCatReg = await prisma.registration.findUnique({ where: { id: catConcurrentReg.id } });
        assertTest(
            12,
            concurrentCatError instanceof HttpException &&
            concurrentCatError.getStatus() === 409 &&
            (postConcurrentCatReg?.raceCategory === 'KM_3' || postConcurrentCatReg?.raceCategory === '3 KM'),
            'Concurrency safety: Race category change rejected (409 Conflict) if payment finalises concurrently',
            `Status: ${concurrentCatError?.getStatus?.()}, raceCategory preserved: ${postConcurrentCatReg?.raceCategory}`
        );

        // =========================================================================
        // PART 4: SYSTEM & FINANCIAL FIELD PROTECTION (Tests 13 - 15)
        // =========================================================================
        console.log('\n--- PART 4: SERVER-SIDE UPDATE WHITELIST TESTS (PUT /registrations/admin/:id) ---');

        const systemFieldReg = await prisma.registration.create({
            data: makeTestRegData('sys_fields', RaceCategory.KM_5, 400, {
                paymentStatus: 'PENDING',
                referenceNumber: 'MAR27-5K-0999',
                razorpayOrderId: 'order_trusted_initial_001',
                razorpayPaymentId: 'pay_trusted_initial_001',
                ticketId: 'tkt_trusted_initial_001',
                finalRegistration: false,
            }),
        });

        // TEST 13: Admin update cannot modify paymentStatus
        let paymentStatusPipeError: any = null;
        try {
            await validationPipe.transform(
                { paymentStatus: 'PAID' },
                { type: 'body', metatype: UpdateRegistrationDto },
            );
        } catch (err) {
            paymentStatusPipeError = err;
        }

        // Bypassed call test
        await regService.updateRegistration(systemFieldReg.id, {
            name: 'Status Bypass Test',
            // @ts-ignore
            paymentStatus: 'PAID',
        } as any);

        const postStatusReg = await prisma.registration.findUnique({ where: { id: systemFieldReg.id } });
        assertTest(
            13,
            paymentStatusPipeError?.getStatus?.() === 400 && postStatusReg?.paymentStatus === 'PENDING',
            'Admin update cannot modify paymentStatus (ValidationPipe 400 and DB preserved as PENDING)',
            `Validation error: ${paymentStatusPipeError?.getStatus?.()}, DB status: ${postStatusReg?.paymentStatus}`
        );

        // TEST 14: Admin update cannot modify referenceNumber
        let refNumberPipeError: any = null;
        try {
            await validationPipe.transform(
                { referenceNumber: 'TAMPERED-REF-007' },
                { type: 'body', metatype: UpdateRegistrationDto },
            );
        } catch (err) {
            refNumberPipeError = err;
        }

        // Bypassed call test
        await regService.updateRegistration(systemFieldReg.id, {
            name: 'Ref Bypass Test',
            // @ts-ignore
            referenceNumber: 'TAMPERED-REF-007',
        } as any);

        const postRefReg = await prisma.registration.findUnique({ where: { id: systemFieldReg.id } });
        assertTest(
            14,
            refNumberPipeError?.getStatus?.() === 400 && postRefReg?.referenceNumber === 'MAR27-5K-0999',
            'Admin update cannot modify referenceNumber (ValidationPipe 400 and DB preserved as MAR27-5K-0999)',
            `Validation error: ${refNumberPipeError?.getStatus?.()}, DB referenceNumber: ${postRefReg?.referenceNumber}`
        );

        // TEST 15: Admin update cannot modify gateway order or payment IDs
        let gatewayPipeError: any = null;
        try {
            await validationPipe.transform(
                {
                    razorpayOrderId: 'order_fake_999',
                    razorpayPaymentId: 'pay_fake_999',
                    ticketId: 'tkt_fake_999',
                },
                { type: 'body', metatype: UpdateRegistrationDto },
            );
        } catch (err) {
            gatewayPipeError = err;
        }

        // Bypassed call test
        await regService.updateRegistration(systemFieldReg.id, {
            name: 'Gateway Bypass Test',
            // @ts-ignore
            razorpayOrderId: 'order_fake_999',
            razorpayPaymentId: 'pay_fake_999',
            ticketId: 'tkt_fake_999',
        } as any);

        const postGatewayReg = await prisma.registration.findUnique({ where: { id: systemFieldReg.id } });
        assertTest(
            15,
            gatewayPipeError?.getStatus?.() === 400 &&
            postGatewayReg?.razorpayOrderId === 'order_trusted_initial_001' &&
            postGatewayReg?.razorpayPaymentId === 'pay_trusted_initial_001' &&
            postGatewayReg?.ticketId === 'tkt_trusted_initial_001',
            'Admin update cannot modify gateway order, payment IDs, or ticketId (ValidationPipe 400 and DB preserved)',
            `Gateway IDs preserved in DB: Order: ${postGatewayReg?.razorpayOrderId}, Payment: ${postGatewayReg?.razorpayPaymentId}, Ticket: ${postGatewayReg?.ticketId}`
        );

        // Teardown
        console.log('\n--- CLEANUP & TEARDOWN ---');
        await cleanupTestRecords();
        const remainingCount = await prisma.registration.count({
            where: { email: { startsWith: 'test_safety_' } },
        });
        assertTest(
            16,
            remainingCount === 0,
            'All temporary test records cleaned up safely',
            `Remaining count: ${remainingCount}`
        );

        console.log('\n================================================================');
        const passedCount = results.filter((r) => r.passed).length;
        console.log(` SUMMARY: ${passedCount}/${results.length} TESTS PASSED`);
        console.log('================================================================\n');

        if (results.some((r) => !r.passed)) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (fatal) {
        console.error('FATAL TEST ERROR:', fatal);
        await cleanupTestRecords();
        process.exit(1);
    } finally {
        await app.close();
    }
}

runStep6_2SafetyTests();
