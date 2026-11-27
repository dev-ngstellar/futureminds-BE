import {
    Injectable,
    InternalServerErrorException,
    HttpException,
    HttpStatus,
    Logger,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistrationService } from '../../registration/service/registration.service';
import { MailService } from '../../mail/mail.service';
import * as crypto from 'crypto';
import { PaymentEntity } from '../entity/payment.entity';
import { EntityMapper } from '../../common/utils/entity.mapper.service';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { ErrorCode, ErrorMessages } from '../../common/error-code';
const Razorpay = require('razorpay');

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private razorpay: any;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => RegistrationService))
        private readonly registrationService: RegistrationService,
        private readonly mailService: MailService,
    ) {
        if (
            !process.env.RAZORPAY_KEY_ID ||
            !process.env.RAZORPAY_KEY_SECRET
        ) {
            throw new Error('Razorpay keys are not configured');
        }

        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }

    // ✅ CREATE ORDER (SERVER-AUTHORITATIVE AMOUNT)
    async createOrder(registrationId: string) {
        try {
            // 1. Fetch registration from DB
            const registration = await this.prisma.registration.findUnique({
                where: { id: registrationId },
            });

            if (!registration) {
                throw new HttpException(
                    'Registration record not found',
                    HttpStatus.NOT_FOUND,
                );
            }

            // 2. State Validation: Reject invalid, already-paid, or cancelled
            if (registration.finalRegistration === true || registration.paymentStatus === 'PAID') {
                throw new HttpException(
                    'Registration is already paid and confirmed',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (registration.paymentStatus === 'CANCELLED') {
                throw new HttpException(
                    'Registration has been cancelled',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // 3. Determine payable amount from trusted registration record
            const amount = registration.amount;
            if (!amount || amount <= 0) {
                throw new HttpException(
                    'Payable amount for this registration is invalid',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // 4. Create Razorpay order
            const order = await this.razorpay.orders.create({
                amount: Math.round(amount * 100),
                currency: 'INR',
                notes: { registrationId },
            });

            this.logger.log(`Razorpay Order Created: ${order.id} for registration: ${registrationId}`);

            // 5. Store order against Payment and Registration records
            await this.prisma.payment.create({
                data: {
                    registrationId,
                    razorpayOrderId: order.id,
                    amount,
                    status: 'PENDING',
                },
            });

            await this.prisma.registration.update({
                where: { id: registrationId },
                data: { razorpayOrderId: order.id },
            });

            return {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
            };
        } catch (error) {
            this.logger.error(
                'Failed to create Razorpay order',
                error.stack,
            );
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException(
                'Failed to create Razorpay order',
            );
        }
    }

    // ✅ VERIFY PAYMENT SIGNATURE (CONSTANT-TIME)
    verifyPayment(
        orderId: string,
        paymentId: string,
        signature: string,
    ): boolean {
        if (!process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('RAZORPAY_KEY_SECRET is not configured');
        }

        if (!signature || !orderId || !paymentId) {
            return false;
        }

        const payload = `${orderId}|${paymentId}`;

        const expectedSignature = crypto
            .createHmac(
                'sha256',
                process.env.RAZORPAY_KEY_SECRET as string,
            )
            .update(payload)
            .digest('hex');

        const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
        const signatureBuffer = Buffer.from(signature, 'utf-8');

        // Check buffer lengths before timingSafeEqual to prevent RangeError
        if (expectedBuffer.length !== signatureBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    }

    // ✅ VERIFY AND FINALIZE PAYMENT (RELIABLE & IDEMPOTENT)
    async verifyAndFinalizePayment(data: VerifyPaymentDto) {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            registrationId,
        } = data;

        // 1. Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new HttpException(
                'Missing required payment verification details',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 2. Verify HMAC SHA-256 signature
        const isValid = this.verifyPayment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        );

        if (!isValid) {
            this.logger.warn(
                `Payment signature verification failed for order: ${razorpay_order_id}`,
            );
            throw new HttpException(
                ErrorMessages[ErrorCode.PAYMENT_VERIFICATION_FAILED]?.message ||
                    'Payment signature verification failed',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 3. Find payment record and verify order exists
        const payment = await this.prisma.payment.findFirst({
            where: { razorpayOrderId: razorpay_order_id },
        });

        if (!payment) {
            this.logger.warn(
                `Payment record not found for orderId: ${razorpay_order_id}`,
            );
            throw new HttpException(
                'Payment record not found for this order',
                HttpStatus.NOT_FOUND,
            );
        }

        // 4. Validate registrationId association if provided by caller
        if (registrationId && payment.registrationId !== registrationId) {
            this.logger.warn(
                `Order ${razorpay_order_id} does not match specified registration ${registrationId} (actual: ${payment.registrationId})`,
            );
            throw new HttpException(
                'Order does not match the specified registration',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 5. Finalize registration via shared idempotent finalization service
        const { registration, newlyFinalized } =
            await this.registrationService.finalizeRegistration(
                razorpay_order_id,
                razorpay_payment_id,
                { razorpaySignature: razorpay_signature },
            );

        this.logger.log(
            `Payment verified & registration finalized: registrationId=${registration.id} referenceNumber=${registration.referenceNumber} newlyFinalized=${newlyFinalized}`,
        );

        return {
            success: true,
            referenceNumber: registration.referenceNumber,
            paymentStatus: registration.paymentStatus,
            registrationId: registration.id,
            newlyFinalized,
            contactPerson: {
                name: 'Dr. Ramesh Nivash, BE, MBA, MA, MSc',
                mobile: process.env.MARATHON_CONTACT_MOBILE || '+91 94441 23456',
            },
        };
    }

    // ✅ GET PAYMENT STATUS BY RAZORPAY ORDER ID
    async getPaymentStatus(registrationId: string): Promise<PaymentEntity> {
        try {
            const payment = await this.prisma.payment.findFirst({
                where: { registrationId },
            });

            return EntityMapper.toEntity(PaymentEntity, payment);
        } catch (error) {
            this.logger.error(
                `Failed to fetch payment status for registration ${registrationId}`,
                (error as any).stack,
            );
            throw error;
        }
    }

    async getAllPayments(): Promise<PaymentEntity[]> {
        try {
            const payments = await this.prisma.payment.findMany({
                orderBy: { createdAt: 'desc' },
            });
            return EntityMapper.toEntities(PaymentEntity, payments);
        } catch (error) {
            this.logger.error('Failed to fetch all payments', error.stack);
            throw error;
        }
    }
}
