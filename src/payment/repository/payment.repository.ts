import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayPaymentMethodEnum } from '../enums/razorpay-payment-method.enum';

@Injectable()
export class PaymentRepository {
    private readonly logger = new Logger(PaymentRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    // CREATE PAYMENT (on order creation)
    async create(data: {
        registrationId: string;
        razorpayOrderId: string;
        amount: number;
    }) {
        try {
            this.logger.log(
                `Creating payment | registrationId=${data.registrationId} orderId=${data.razorpayOrderId}`,
            );

            return await this.prisma.payment.create({
                data: {
                    registrationId: data.registrationId,
                    razorpayOrderId: data.razorpayOrderId,
                    amount: data.amount,
                    status: 'PENDING',
                    gateway: 'RAZORPAY',
                },
            });
        } catch (error) {
            this.logger.error(
                `Failed to create payment | registrationId=${data.registrationId}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY ORDER ID
    async findByOrderId(orderId: string) {
        try {
            this.logger.debug(`Finding payment by orderId=${orderId}`);

            return await this.prisma.payment.findFirst({
                where: { razorpayOrderId: orderId },
            });
        } catch (error) {
            this.logger.error(
                `Failed to find payment by orderId=${orderId}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY PAYMENT ID
    async findByPaymentId(paymentId: string) {
        try {
            this.logger.debug(`Finding payment by paymentId=${paymentId}`);

            return await this.prisma.payment.findFirst({
                where: { razorpayPaymentId: paymentId },
            });
        } catch (error) {
            this.logger.error(
                `Failed to find payment by paymentId=${paymentId}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY REGISTRATION ID
    async findByRegistrationId(registrationId: string) {
        try {
            this.logger.log(
                `Finding payment by registrationId=${registrationId}`,
            );

            return await this.prisma.payment.findFirst({
                where: { registrationId },
            });
        } catch (error) {
            this.logger.error(
                `Failed to find payment by registrationId=${registrationId}`,
                error.stack,
            );
            throw error;
        }
    }

    // MARK PAYMENT SUCCESS (webhook)
    async markPaid(params: {
        id: string;
        razorpayPaymentId: string;
        method?: RazorpayPaymentMethodEnum;
        webhookEvent?: string;
    }) {
        try {
            this.logger.log(
                `Marking payment PAID | paymentId=${params.id} razorpayPaymentId=${params.razorpayPaymentId}`,
            );

            return await this.prisma.payment.update({
                where: { id: params.id },
                data: {
                    razorpayPaymentId: params.razorpayPaymentId,
                    status: 'PAID',
                    verified: true,
                    method:
                        params.method ?? RazorpayPaymentMethodEnum.UNKNOWN,
                    webhookEvent: params.webhookEvent,
                },
            });
        } catch (error) {
            this.logger.error(
                `Failed to mark payment PAID | paymentId=${params.id}`,
                error.stack,
            );
            throw error;
        }
    }

    // MARK PAYMENT FAILED
    async markFailed(params: {
        orderId: string;
        reason?: string;
        webhookEvent?: string;
    }) {
        try {
            this.logger.warn(
                `Marking payment FAILED | orderId=${params.orderId}`,
            );

            return await this.prisma.payment.updateMany({
                where: { razorpayOrderId: params.orderId },
                data: {
                    status: 'FAILED',
                    failureReason: params.reason,
                    webhookEvent: params.webhookEvent,
                },
            });
        } catch (error) {
            this.logger.error(
                `Failed to mark payment FAILED | orderId=${params.orderId}`,
                error.stack,
            );
            throw error;
        }
    }

    // LIST PAYMENTS (Admin)
    async findAll() {
        try {
            this.logger.debug('Fetching all payments');

            return await this.prisma.payment.findMany({
                orderBy: { createdAt: 'desc' },
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch payment list',
                error.stack,
            );
            throw error;
        }
    }
}
