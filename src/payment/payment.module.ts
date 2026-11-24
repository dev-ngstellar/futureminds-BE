import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './controller/payment.controller';
import { RazorpayController } from './controller/razorpay.controller';
import { PaymentService } from './service/payment.service';
import { RazorpayPaymentService } from './service/razorpay.payment.service';
import { PaymentRepository } from './repository/payment.repository';
import { MailModule } from '../mail/mail.module';
import { RegistrationModule } from '../registration/registration.module';
import { PaymentWebhookController } from './controller/payment.webhook.controller';
import { PaymentWebhookService } from './service/payment.webhook.service';
import { WebhookRepository } from './repository/payment.webhook.repository';
import { WebhookController } from './controller/webhook.controller';
import { WebhookService } from './service/webhook.service';

@Module({
    imports: [MailModule, forwardRef(() => RegistrationModule)],
    controllers: [
        PaymentController,
        RazorpayController,
        PaymentWebhookController,
        WebhookController,
    ],
    providers: [
        PaymentService,
        RazorpayPaymentService,
        PaymentRepository,
        PaymentWebhookService,
        WebhookRepository,
        WebhookService,
    ],
    exports: [PaymentService, RazorpayPaymentService, PaymentRepository],
})
export class PaymentModule { }
