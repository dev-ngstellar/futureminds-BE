import { RazorpayPaymentMethodEnum } from '../enums/razorpay-payment-method.enum';
import { RazorpayPayment } from '../enums/razorpay-payment.enum';

export class PaymentEntity {
    id: string;
    registrationId: string;
    gateway: RazorpayPaymentMethodEnum;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    amount: number;
    currency: string;
    method: RazorpayPaymentMethodEnum;
    status: RazorpayPayment;
    verified: boolean;
    webhookEvent?: string;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
