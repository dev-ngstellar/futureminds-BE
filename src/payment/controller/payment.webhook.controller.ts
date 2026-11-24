import {
    Controller,
    Post,
    Req,
    BadRequestException,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentWebhookService } from '../service/payment.webhook.service';

@Controller(['/api/payment/webhook', '/api/payment/webhoook', '/payment/webhook'])
export class PaymentWebhookController {
    private readonly logger = new Logger(
        PaymentWebhookController.name,
    );

    constructor(
        private readonly paymentWebhookService: PaymentWebhookService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Req() req: Request) {
        this.logger.log('Received payment webhook request');

        const signature = req.headers['x-razorpay-signature'] as string;
        const rawBody = (req as any).rawBody ?? req.body;
        if (!rawBody || !signature) {
            this.logger.warn('Webhook rejected: Missing raw body or signature',);
            throw new BadRequestException('Missing raw body or signature',);
        }
        const isValid = this.paymentWebhookService.verifyWebhookSignature(rawBody, signature,);

        if (!isValid) {
            this.logger.warn('Webhook rejected: Invalid signature',);
            throw new BadRequestException('Invalid webhook signature',);
        }

        const eventPayload = Buffer.isBuffer(rawBody)
            ? JSON.parse(rawBody.toString('utf-8'))
            : typeof rawBody === 'string'
            ? JSON.parse(rawBody)
            : rawBody;

        const eventId =
            (req.headers['x-razorpay-event-id'] as string) ||
            eventPayload?.event_id ||
            eventPayload?.id;

        this.logger.log(
            `Webhook received | event=${eventPayload.event} eventId=${eventId ?? 'N/A'}`,
        );

        try {
            await this.paymentWebhookService.handleWebhook(signature, eventPayload, eventId);
        } catch (error) {
            this.logger.error(
                'Webhook processing failed',
                error.stack,
            );
            throw error; // Razorpay will retry
        }

        return { status: 'ok' };
    }

    @Post('verify-signature')
    @HttpCode(HttpStatus.OK)
    async verifySignature(@Req() req: Request) {
        this.logger.log('Received signature verification request');

        const signature = req.headers['x-razorpay-signature'] as string;
        const rawBody = (req as any).rawBody ?? req.body;

        if (!rawBody || !signature) {
            this.logger.warn(
                'Signature verification failed: Missing raw body or signature',
            );
            throw new BadRequestException('Missing raw body or signature');
        }

        const isValid = this.paymentWebhookService.verifyWebhookSignature(
            rawBody,
            signature,
        );

        this.logger.log(
            `Signature verification result | valid=${isValid}`,
        );

        return { valid: isValid };
    }
}
