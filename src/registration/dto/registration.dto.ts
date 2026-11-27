import {
  IsString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsUUID,
  Length,
  Matches,
  Min,
  Max,
  IsInt,
  Equals,
  MaxLength,
} from 'class-validator';

export enum RaceCategory {
  KM_1_5 = '1.5 KM',
  KM_3 = '3 KM',
  KM_5 = '5 KM',
  KM_5_ALT = '5KM',
  KM_3_ALT = '3KM',
  KM_1_5_ALT = '1.5KM',
  KM_5_NUM = '5',
  KM_3_NUM = '3',
  KM_1_5_NUM = '1.5',
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Others = 'Others',
}

export enum TshirtSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
  XXXL = 'XXXL',
}

export enum EmergencyContactRelationship {
  Father = 'Father',
  Mother = 'Mother',
  Spouse = 'Spouse',
}

export class RegistrationDto {
  @IsUUID('4', { message: 'userId must be a valid UUID v4' })
  @IsOptional()
  userId?: string;

  @IsString({ message: 'Full name must be a text string' })
  @Length(2, 100, { message: 'Full name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z\s.'-]+$/, {
    message: 'Full name can only contain letters, spaces, periods, hyphens and apostrophes',
  })
  name: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Length(5, 100, { message: 'Email address must not exceed 100 characters' })
  email: string;

  @IsEnum(Gender, { message: 'Gender must be Male, Female, or Others' })
  gender: Gender;

  @IsDateString({}, { message: 'Date of birth must be a valid date string (YYYY-MM-DD)' })
  dateOfBirth: string;

  @IsInt({ message: 'Age must be an integer' })
  @Min(3, { message: 'Participant must be at least 3 years old' })
  @Max(100, { message: 'Participant age cannot exceed 100 years' })
  age: number;

  @IsString({ message: 'Present residential address is required' })
  @Length(5, 250, { message: 'Present residential address must be between 5 and 250 characters' })
  presentAddress: string;

  @IsString({ message: 'State is required' })
  @Length(2, 50, { message: 'State must be between 2 and 50 characters' })
  state: string;

  @IsString({ message: 'City is required' })
  @Length(2, 50, { message: 'City must be between 2 and 50 characters' })
  @Matches(/^[a-zA-Z\s.'-]+$/, { message: 'City must contain letters only' })
  city: string;

  @IsString({ message: 'PIN code is required' })
  @Matches(/^[1-9][0-9]{5}$/, { message: 'PIN Code must be a valid 6-digit Indian postal code' })
  pincode: string;

  @IsString({ message: 'Mobile number is required' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Mobile number must be a valid 10-digit Indian mobile number starting with 6-9' })
  mobileNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Medical history cannot exceed 500 characters' })
  medicalHistory?: string;

  @IsEnum(TshirtSize, { message: 'T-shirt size must be one of: XS, S, M, L, XL, XXL, XXXL' })
  tshirtSize: string;

  @IsEnum(RaceCategory, { message: 'Race category must be a valid marathon category (1.5 KM, 3 KM, 5 KM)' })
  raceCategory: RaceCategory;

  @IsString({ message: 'Emergency contact name is required' })
  @Length(2, 100, { message: 'Emergency contact name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z\s.'-]+$/, {
    message: 'Emergency contact name can only contain letters, spaces, periods, hyphens and apostrophes',
  })
  emergencyContactName: string;

  @IsString({ message: 'Emergency contact mobile is required' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Emergency contact mobile must be a valid 10-digit Indian mobile number starting with 6-9' })
  emergencyContactMobile: string;

  @IsEnum(EmergencyContactRelationship, { message: 'Relationship must be Father, Mother, or Spouse' })
  emergencyContactRelationship: EmergencyContactRelationship;

  @Equals(true, { message: 'Safety waiver and participant declaration must be accepted' })
  waiverAccepted: boolean;

  @IsNumber()
  @IsOptional()
  amount?: number;
}
