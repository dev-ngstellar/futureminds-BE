import {
    Injectable,
    Logger,
    InternalServerErrorException,
} from '@nestjs/common';
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayPaymentService {
    private readonly logger = new Logger(RazorpayPaymentService.name);
    private razorpay: any;

    constructor() {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys are not configured');
        }

        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }

    // ✅ FETCH SINGLE PAYMENT BY ID
    async getPaymentById(paymentId: string) {
        try {
            this.logger.log(`Fetching Razorpay payment | paymentId=${paymentId}`);
            return await this.razorpay.payments.fetch(paymentId);
        } catch (error) {
            this.logger.error(
                `Failed to fetch payment from Razorpay | paymentId=${paymentId}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch Razorpay payment details',
            );
        }
    }

    // ✅ GET PAYMENT HISTORY (PAGINATED)
    async getHistory(options?: {
        from?: number;
        to?: number;
        count?: number;
        skip?: number;
    }) {
        try {
            const count = Math.min(options?.count ?? 20, 100);
            const skip = options?.skip ?? 0;

            this.logger.log(
                `Fetching payment history | count=${count}, skip=${skip}`,
            );

            return await this.razorpay.payments.all({
                from: options?.from,
                to: options?.to,
                count,
                skip,
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch payment history from Razorpay',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch Razorpay payment history',
            );
        }
    }

    // ✅ GET ORDERS HISTORY (PAGINATED)
    async getOrdersHistory(options?: {
        from?: number;
        to?: number;
        count?: number;
        skip?: number;
    }) {
        try {
            const count = Math.min(options?.count ?? 20, 100);
            const skip = options?.skip ?? 0;

            this.logger.log(
                `Fetching orders history | count=${count}, skip=${skip}`,
            );

            return await this.razorpay.orders.all({
                from: options?.from,
                to: options?.to,
                count,
                skip,
            });
        } catch (error) {
            this.logger.error(
                'Failed to fetch orders history from Razorpay',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch Razorpay orders history',
            );
        }
    }

    // ✅ GET PAYMENT HISTORY FROM RAZORPAY (PAGINATED)
    async getPaymentHistory(options?: {
        from?: number;   // unix timestamp (seconds)
        to?: number;     // unix timestamp (seconds)
        count?: number;  // page size (max 100)
        skip?: number;   // offset
    }) {
        try {
            const count = Math.min(options?.count ?? 20, 100);
            const skip = options?.skip ?? 0;

            this.logger.log(
                `Fetching payment history | count=${count}, skip=${skip}`,
            );

            const payments = await this.razorpay.payments.all({
                from: options?.from,
                to: options?.to,
                count,
                skip,
            });

            return {
                count: payments.items?.length ?? 0,
                items: payments.items,
            };
        } catch (error) {
            this.logger.error(
                'Failed to fetch payment history from Razorpay',
                error.stack,
            );
            throw new InternalServerErrorException(
                'Unable to fetch Razorpay payment history',
            );
        }
    }

}
