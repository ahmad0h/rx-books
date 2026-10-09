import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

/** Phone: digits with optional + ( ) - . and spaces; 7 to 15 digits in total. */
const PHONE = /^(?=(?:\D*\d){7,15}\D*$)[0-9+().\-\s]+$/;

/** Everything needed to add or edit a pharmacy. All fields are required. */
export class PharmacyInput {
  @trimmed()
  @IsString({ message: 'Enter the pharmacy name.' })
  @MinLength(2, { message: 'Enter the pharmacy name.' })
  @MaxLength(160, { message: 'The pharmacy name is too long.' })
  name: string;

  @trimmed()
  @IsString({ message: "Enter the owner's name." })
  @MinLength(2, { message: "Enter the owner's name." })
  @MaxLength(120, { message: "The owner's name is too long." })
  ownerName: string;

  @trimmed()
  @IsString({ message: "Enter the owner's phone number." })
  @Matches(PHONE, { message: 'Enter a valid phone number.' })
  @MaxLength(32, { message: 'Enter a valid phone number.' })
  ownerPhone: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Enter a valid email address.' })
  ownerEmail: string;
}
