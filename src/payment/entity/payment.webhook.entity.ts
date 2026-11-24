export class WebhookEntity {
    id: string;
    event: string;
    eventId?: string;
    signature: string;
    verified: boolean;
    payload: Record<string, any>;
    headers?: Record<string, any>;
    processed: boolean;
    processingError?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paymentId?: string;
    createdAt: Date;
}
