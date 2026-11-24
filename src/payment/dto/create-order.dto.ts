import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    registrationId: string;

    @IsNumber()
    @IsOptional()
    amount?: number;
}
