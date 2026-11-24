import {
    Controller,
    Post,
    Body,
    Logger,
    HttpException,
    HttpStatus,
    Get,
    Param,
    UseGuards,
} from '@nestjs/common';
import { PaymentService } from '../service/payment.service';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErrorCode, ErrorMessages } from '../../common/error-code';

@Controller('payment')
export class PaymentController {
    private readonly logger = new Logger(PaymentController.name);

    constructor(private readonly paymentService: PaymentService) { }

    @Post('order')
    async createOrder(
        @Body() body: CreateOrderDto,
    ) {
        try {
            const { registrationId } = body;
            if (!registrationId) {
                throw new HttpException(
                    'registrationId is required',
                    HttpStatus.BAD_REQUEST,
                );
            }
            this.logger.log(
                `Creating payment order for registration: ${registrationId}`,
            );
            const result = await this.paymentService.createOrder(registrationId);
            return {
                message: 'Payment order created successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                'Failed to create payment order',
                error.stack,
            );
            if (error instanceof HttpException) throw error;
            throw new HttpException(
                ErrorMessages[
                ErrorCode.PAYMENT_ORDER_CREATION_FAILED
                ],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('verify')
    async verifyPayment(@Body() body: VerifyPaymentDto) {
        try {
            this.logger.log(`Verifying payment for order: ${body.razorpay_order_id}`);

            const result = await this.paymentService.verifyAndFinalizePayment(body);

            return {
                message: 'Payment verified and registration finalized successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error('Payment verification failed', error.stack);
            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.PAYMENT_VERIFICATION_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('all-payments')
    @UseGuards(JwtAuthGuard)
    async getAllPayments() {
        try {
            this.logger.log('Fetching all payments');
            const result = await this.paymentService.getAllPayments();
            return {
                message: 'All payments fetched successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error('Failed to fetch all payments', error.stack);
            if (error instanceof HttpException) throw error;
            throw new HttpException(
                ErrorMessages[ErrorCode.PAYMENT_LIST_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('payment-status/:registrationId')
    async getPaymentStatus(@Param('registrationId') registrationId: string) {
        try {
            this.logger.log(`Fetching payment status for registration: ${registrationId}`);
            const result = await this.paymentService.getPaymentStatus(registrationId);
            if (!result) {
                throw new HttpException('Payment record not found', HttpStatus.NOT_FOUND);
            }
            // Sanitize: Do not expose razorpaySignature in public responses
            const sanitized = {
                status: result.status,
                amount: result.amount,
                currency: result.currency,
                method: result.method,
                verified: result.verified,
                createdAt: result.createdAt,
            };
            return {
                message: 'Payment status fetched successfully',
                data: sanitized,
            };
        } catch (error) {
            this.logger.error(
                'Failed to fetch payment status',
                (error as any).stack,
            );
            if (error instanceof HttpException) throw error;

            throw new HttpException(
                'Failed to fetch payment status',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
