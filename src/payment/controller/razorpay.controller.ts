import {
    Controller,
    Get,
    Logger,
    HttpException,
    HttpStatus,
    UseGuards,
    Query,
} from '@nestjs/common';
import { RazorpayPaymentService } from '../service/razorpay.payment.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErrorCode, ErrorMessages } from '../../common/error-code';

@Controller('payment/razorpay')
export class RazorpayController {
    private readonly logger = new Logger(RazorpayController.name);

    constructor(
        private readonly razorpayPaymentService: RazorpayPaymentService,
    ) { }

    @Get('orders')
    @UseGuards(JwtAuthGuard)
    async getOrders(
        @Query('page') page = 1,
        @Query('size') pageSize = 10,
    ) {
        try {
            page = Number(page);
            pageSize = Number(pageSize);
            pageSize = Math.min(pageSize, 100);

            const skip = (page - 1) * pageSize;

            this.logger.log(
                `Fetching razorpay orders | page=${page}, pageSize=${pageSize}`,
            );

            const orders = await this.razorpayPaymentService.getOrdersHistory({
                count: pageSize,
                skip,
            });

            return {
                message: 'Orders history fetched successfully',
                pagination: {
                    page,
                    pageSize,
                    count: orders.items?.length ?? 0,
                },
                data: orders.items,
            };
        } catch (error) {
            this.logger.error('Failed to fetch orders history', error.stack);

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('payment-history')
    @UseGuards(JwtAuthGuard)
    async getPaymentHistory(
        @Query('page') page = 1,
        @Query('size') pageSize = 10,
    ) {
        try {
            page = Number(page);
            pageSize = Number(pageSize);
            pageSize = Math.min(pageSize, 100);

            const skip = (page - 1) * pageSize;
            this.logger.log(`Fetching razorpay orders | page=${page}, pageSize=${pageSize}`,);
            const orders = await this.razorpayPaymentService.getPaymentHistory({
                count: pageSize,
                skip,
            });

            return {
                message: 'Orders history fetched successfully',
                pagination: {
                    page,
                    pageSize,
                    count: orders.items?.length ?? 0,
                },
                data: orders.items,
            };
        } catch (error) {
            this.logger.error('Failed to fetch orders history', error.stack);

            if (error instanceof HttpException) throw error;

            throw new HttpException(
                ErrorMessages[ErrorCode.REGISTRATION_FETCH_FAILED],
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
