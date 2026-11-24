import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { WebhookRepository } from '../repository/payment.webhook.repository';
import { ErrorCode, ErrorMessages } from '../../common/error-code';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly webhookRepository: WebhookRepository,
    ) { }

    async getAll() {
        try {
            return await this.webhookRepository.findAll();
        } catch (error) {
            this.logger.error('Failed to fetch webhooks', error.stack);

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getByOrderId(orderId: string) {
        try {
            return await this.webhookRepository.findByOrderId(orderId);
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

    async getByPaymentId(paymentId: string) {
        try {
            return await this.webhookRepository.findByPaymentId(paymentId);
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

