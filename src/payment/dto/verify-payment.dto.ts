import { IsString, IsOptional } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  razorpay_order_id: string;

  @IsString()
  razorpay_payment_id: string;

  @IsString()
  razorpay_signature: string;

  @IsString()
  @IsOptional()
  registrationId?: string;
}
