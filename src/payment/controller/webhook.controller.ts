import {
    Controller,
    Get,
    Logger,
    Param,
    UseGuards,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WebhookService } from '../service/webhook.service';
import { ErrorCode, ErrorMessages } from '../../common/error-code';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly webhookService: WebhookService,
    ) { }

    // List all webhooks (admin/debug)
    @Get()
    async getAllWebhooks() {
        try {
            this.logger.log('Fetching all webhooks');
            const webhooks = await this.webhookService.getAll();

            return {
                message: 'Webhooks fetched successfully',
                count: webhooks.length,
                data: webhooks,
            };
        } catch (error) {
            this.logger.error('Failed to fetch webhooks', error.stack);

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Get webhooks by Razorpay order id
    @Get('order/:orderId')
    async getByOrderId(@Param('orderId') orderId: string) {
        try {
            this.logger.log(`Fetching webhooks for orderId=${orderId}`);
            const webhooks = await this.webhookService.getByOrderId(orderId);

            return {
                message: 'Webhooks fetched successfully',
                count: webhooks.length,
                data: webhooks,
            };
        } catch (error) {
            this.logger.error(
                `Failed to fetch webhooks for orderId=${orderId}`,
                error.stack,
            );

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Get webhooks by Razorpay payment id
    @Get('payment/:paymentId')
    async getByPaymentId(@Param('paymentId') paymentId: string) {
        try {
            this.logger.log(`Fetching webhooks for paymentId=${paymentId}`);
            const webhooks =
                await this.webhookService.getByPaymentId(paymentId);

            return {
                message: 'Webhooks fetched successfully',
                data: webhooks,
            };
        } catch (error) {
            this.logger.error(
                `Failed to fetch webhooks for paymentId=${paymentId}`,
                error.stack,
            );

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}