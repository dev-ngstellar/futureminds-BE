import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookRepository } from '../repository/payment.webhook.repository';
import { PaymentRepository } from '../repository/payment.repository';
import { RegistrationService } from '../../registration/service/registration.service';
import { MailService } from '../../mail/mail.service';
import { RazorpayPaymentMethodEnum } from '../enums/razorpay-payment-method.enum';
import { RazorpayPaymentService } from './razorpay.payment.service';

@Injectable()
export class PaymentWebhookService {

    private readonly logger = new Logger(PaymentWebhookService.name);
    private readonly webhookSecret =
        process.env.RAZORPAY_WEBHOOK_SECRET;

    constructor(
        private readonly webhookRepository: WebhookRepository,
        private readonly paymentRepository: PaymentRepository,
        @Inject(forwardRef(() => RegistrationService))
        private readonly registrationService: RegistrationService,
        private readonly mailService: MailService,
        private readonly razorpayPaymentService: RazorpayPaymentService,
    ) { }

    verifyWebhookSignature(
        rawBody: any,
        signature: string,
    ): boolean {
        if (!this.webhookSecret) {
            throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
        }

        // Ensure we always hash a Buffer/string, even if we somehow
        // receive a parsed object instead of the raw payload.
        const payloadBuffer = Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(
                typeof rawBody === 'string'
                    ? rawBody
                    : JSON.stringify(rawBody),
            );

        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(payloadBuffer)
            .digest('hex');

        // ✅ Prevent timingSafeEqual crash
        if (expectedSignature.length !== signature.length) {
            return false;
        }

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature),
        );
    }

    async handleWebhook(signature: string, eventPayload: any, eventId?: string) {
        try {
            const {
                event,
                payload,
                created_at: eventCreatedAt,
            } = eventPayload ?? {};

            const resolvedEventId =
                eventId || eventPayload?.event_id || eventPayload?.id || null;

            // 0️⃣ Webhook Idempotency Check: skip already processed events
            if (resolvedEventId) {
                const existingWebhook =
                    await this.webhookRepository.findByEventId(resolvedEventId);
                if (existingWebhook && existingWebhook.processed) {
                    this.logger.log(
                        `Duplicate webhook event ignored | eventId=${resolvedEventId}`,
                    );
                    return;
                }
            }

            this.logger.log('eventPayload', eventPayload);
            const paymentEntity = payload?.payment?.entity;
            const registrationId = payload?.payment?.entity?.notes?.registrationId;
            const orderEntity = payload?.order?.entity;

            this.logger.log('registrationId', registrationId);
            this.logger.log('paymentEntity', paymentEntity);
            this.logger.log('orderEntity', orderEntity);

            let razorpayPaymentId: string | undefined = paymentEntity?.id;
            this.logger.log('razorpayPaymentId', razorpayPaymentId);
            let razorpayOrderId: string | undefined =
                paymentEntity?.order_id ?? orderEntity?.id ?? null;
            this.logger.log('razorpayOrderId', razorpayOrderId);

            if (!razorpayOrderId && razorpayPaymentId) {
                try {
                    this.logger.log('fetching full payment from Razorpay API');
                    const fullPayment =
                        await this.razorpayPaymentService.getPaymentById(
                            razorpayPaymentId,
                        );
                    this.logger.log('fullPayment', fullPayment);
                    if (fullPayment?.order_id) {
                        this.logger.log('fullPayment.order_id', fullPayment.order_id);
                        razorpayOrderId = fullPayment.order_id;
                        this.logger.log(
                            `Backfilled orderId from Razorpay API | orderId=${razorpayOrderId} paymentId=${razorpayPaymentId}`,
                        );
                    } else {
                        this.logger.warn(
                            `Razorpay payment has no order_id | paymentId=${razorpayPaymentId}`,
                        );
                    }
                } catch (fetchError) {
                    this.logger.error(
                        `Failed to backfill orderId from Razorpay for paymentId=${razorpayPaymentId}`,
                        fetchError.stack,
                    );
                }
            }

            this.logger.log(
                `Handling webhook | event=${event} orderId=${razorpayOrderId ?? 'N/A'} paymentId=${razorpayPaymentId ?? 'N/A'
                }`,
            );

            // 1️⃣ Persist webhook row
            const webhook = await this.webhookRepository.create({
                event,
                eventId: resolvedEventId ?? undefined,
                signature,
                payload: eventPayload,
                razorpayOrderId: razorpayOrderId ?? undefined,
                razorpayPaymentId: razorpayPaymentId ?? undefined,
            });
            this.logger.log('webhook', webhook);

            await this.webhookRepository.markVerified(webhook.id);
            this.logger.log('webhook marked verified');

            // 2️⃣ Handle payment failure event
            if (event === 'payment.failed') {
                this.logger.warn(`Processing payment.failed event for orderId=${razorpayOrderId}`);
                const failureReason =
                    paymentEntity?.error_description ||
                    paymentEntity?.error_reason ||
                    'Payment failed';

                if (razorpayOrderId) {
                    await this.paymentRepository.markFailed({
                        orderId: razorpayOrderId,
                        reason: failureReason,
                        webhookEvent: event,
                    });
                }
                await this.webhookRepository.markProcessed(webhook.id);
                return;
            }

            // 3️⃣ Handle payment success events (order.paid or payment.captured)
            if (event === 'order.paid' || event === 'payment.captured') {
                this.logger.log(`Processing payment success event: ${event}`);

                if (razorpayOrderId) {
                    this.logger.log('finalizing registration via orderId');
                    await this.registrationService.finalizeRegistration(
                        razorpayOrderId,
                        razorpayPaymentId ?? '',
                        { webhookId: webhook.id },
                    );
                } else if (registrationId) {
                    this.logger.log(
                        `finalizing registration via registrationId from notes | registrationId=${registrationId}`,
                    );
                    await this.registrationService.finalizeRegistrationByRegistrationId(
                        registrationId,
                        razorpayPaymentId ?? '',
                    );
                } else {
                    this.logger.warn(
                        `Webhook success event ${event} missing both orderId and registrationId`,
                    );
                }
            }

            const markedProcessedWebhook = await this.webhookRepository.markProcessed(webhook.id);
            this.logger.log('markedProcessedWebhook', markedProcessedWebhook);
        } catch (error) {
            this.logger.error('Webhook handling failed', error.stack);
            throw error;
        }
    }

}
