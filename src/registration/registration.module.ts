import { Module, forwardRef } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { MailModule } from '../mail/mail.module';
import { RegistrationController } from './controller/registration.controller';
import { RegistrationService } from './service/registration.service';
import { RegistrationRepository } from './repository/registration.repository';

@Module({
    imports: [forwardRef(() => PaymentModule), MailModule],
    controllers: [RegistrationController],
    providers: [RegistrationService, RegistrationRepository],
    exports: [RegistrationService, RegistrationRepository],
})
export class RegistrationModule { }
