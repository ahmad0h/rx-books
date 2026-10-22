import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ACCOUNT_KINDS, type AccountKind } from './pharmacy-account.entity.js';

const trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

/** Trims; an empty string becomes null. */
const optional = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Everything needed to add or edit a pharmacy account. */
export class PharmacyAccountInput {
  @trimmed()
  @IsString({ message: 'Enter a name for the account.' })
  @MinLength(2, { message: 'Enter a name for the account.' })
  @MaxLength(120, { message: 'The name is too long.' })
  name: string;

  @IsIn(ACCOUNT_KINDS, { message: 'Choose checking, savings or credit card.' })
  kind: AccountKind;

  @trimmed()
  @IsString({ message: 'Enter the bank.' })
  @MinLength(2, { message: 'Enter the bank.' })
  @MaxLength(80, { message: 'The bank name is too long.' })
  bank: string;

  @trimmed()
  @Matches(/^\d{4}$/, {
    message: 'Enter the last 4 digits of the account number.',
  })
  lastFour: string;

  @Matches(/^\d{4}$/, { message: 'Choose the chart-of-accounts code.' })
  coaCode: string;

  @optional()
  @IsOptional()
  @Matches(DATE, { message: 'The opening date must be a date (YYYY-MM-DD).' })
  openedOn?: string | null;

  @optional()
  @IsOptional()
  @Matches(DATE, { message: 'The closing date must be a date (YYYY-MM-DD).' })
  closedOn?: string | null;

  @optional()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'The notes are too long.' })
  notes?: string | null;
}
