import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WebhookRepository {
    private readonly logger = new Logger(WebhookRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    // CREATE WEBHOOK (on arrival)
    async create(data: {
        event: string;
        eventId?: string;
        signature: string;
        payload: Record<string, any>;
        headers?: Record<string, any>;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        paymentId?: string;
    }) {
        try {
            this.logger.log(
                `Creating webhook | event=${data.event} orderId=${data.razorpayOrderId ?? 'N/A'}`,
            );

            const webhook = await this.prisma.webhook.create({
                data: {
                    event: data.event,
                    eventId: data.eventId,
                    signature: data.signature,
                    payload: data.payload,
                    headers: data.headers,
                    razorpayOrderId: data.razorpayOrderId,
                    razorpayPaymentId: data.razorpayPaymentId,
                    paymentId: data.paymentId,
                },
            });
            this.logger.log('create webhook result', webhook);
            return webhook;
        } catch (error) {
            this.logger.error(
                `Failed to create webhook | event=${data.event}`,
                error.stack,
            );
            throw error;
        }
    }

    // MARK WEBHOOK AS VERIFIED
    async markVerified(id: string) {
        try {
            this.logger.log(`Marking webhook verified | id=${id}`);

            const updatedWebhook = await this.prisma.webhook.update({
                where: { id },
                data: { verified: true },
            });
            this.logger.log('markVerified webhook result', updatedWebhook);
            return updatedWebhook;
        } catch (error) {
            this.logger.error(
                `Failed to mark webhook verified | id=${id}`,
                error.stack,
            );
            throw error;
        }
    }

    // MARK WEBHOOK AS PROCESSED
    async markProcessed(id: string) {
        try {
            this.logger.log(`Marking webhook processed | id=${id}`);

            const updatedWebhook = await this.prisma.webhook.update({
                where: { id },
                data: { processed: true },
            });
            this.logger.log('markProcessed webhook result', updatedWebhook);
            return updatedWebhook;
        } catch (error) {
            this.logger.error(
                `Failed to mark webhook processed | id=${id}`,
                error.stack,
            );
            throw error;
        }
    }

    // MARK WEBHOOK AS FAILED
    async markFailed(id: string, errorMessage: string) {
        try {
            this.logger.warn(
                `Marking webhook failed | id=${id}`,
            );

            const updatedWebhook = await this.prisma.webhook.update({
                where: { id },
                data: {
                    processed: false,
                    processingError: errorMessage,
                },
            });
            this.logger.log('markFailed webhook result', updatedWebhook);
            return updatedWebhook;
        } catch (error) {
            this.logger.error(
                `Failed to mark webhook failed | id=${id}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY RAZORPAY PAYMENT ID (IDEMPOTENCY)
    async findByPaymentId(razorpayPaymentId: string) {
        try {
            this.logger.log(
                `Finding webhook by razorpayPaymentId=${razorpayPaymentId}`,
            );

            const webhook = await this.prisma.webhook.findFirst({
                where: { razorpayPaymentId },
            });
            this.logger.log('findByPaymentId webhook result', webhook);
            return webhook;
        } catch (error) {
            this.logger.error(
                `Failed to find webhook by razorpayPaymentId=${razorpayPaymentId}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY EVENT ID (IDEMPOTENCY)
    async findByEventId(eventId: string) {
        try {
            this.logger.log(`Finding webhook by eventId=${eventId}`);
            return await this.prisma.webhook.findFirst({
                where: { eventId },
            });
        } catch (error) {
            this.logger.error(
                `Failed to find webhook by eventId=${eventId}`,
                error.stack,
            );
            throw error;
        }
    }

    // FIND BY ORDER ID
    async findByOrderId(razorpayOrderId: string) {
        try {
            this.logger.log(
                `Finding webhooks by razorpayOrderId=${razorpayOrderId}`,
            );

            const webhooks = await this.prisma.webhook.findMany({
                where: { razorpayOrderId },
                orderBy: { createdAt: 'desc' },
            });
            this.logger.log('findByOrderId webhooks result', webhooks);
            return webhooks;
        } catch (error) {
            this.logger.error(
                `Failed to find webhooks by razorpayOrderId=${razorpayOrderId}`,
                error.stack,
            );
            throw error;
        }
    }

    // LIST ALL WEBHOOKS (ADMIN / DEBUG)
    async findAll() {
        try {
            this.logger.log('Fetching all webhooks');

            const webhooks = await this.prisma.webhook.findMany({
                orderBy: { createdAt: 'desc' },
            });
            this.logger.log('findAll webhooks result', webhooks);
            return webhooks;
        } catch (error) {
            this.logger.error(
                'Failed to fetch webhook list',
                error.stack,
            );
            throw error;
        }
    }
}
