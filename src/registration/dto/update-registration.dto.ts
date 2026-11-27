import {
  IsString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
  Length,
} from 'class-validator';
import { Gender, RaceCategory, TshirtSize, EmergencyContactRelationship } from './registration.dto';

export class UpdateRegistrationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  presentAddress?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @Length(5, 6)
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @IsOptional()
  medicalHistory?: string;

  @IsEnum(TshirtSize)
  @IsOptional()
  tshirtSize?: string;

  @IsEnum(RaceCategory)
  @IsOptional()
  raceCategory?: RaceCategory;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactMobile?: string;

  @IsEnum(EmergencyContactRelationship)
  @IsOptional()
  emergencyContactRelationship?: EmergencyContactRelationship;

  @IsBoolean()
  @IsOptional()
  waiverAccepted?: boolean;
}
