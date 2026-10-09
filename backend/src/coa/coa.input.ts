import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ACCOUNT_TYPES,
  EXPENSE_GROUPS,
  type AccountType,
  type ExpenseGroup,
} from './coa-account.entity.js';

const trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

/** Empty text becomes null. */
const optionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value ?? null;
    const t = value.trim();
    return t === '' ? null : t;
  });

/** Fields shared by "add account" and "edit account". */
export class CoaFieldsInput {
  @trimmed()
  @IsString({ message: 'Enter the account name.' })
  @MinLength(2, { message: 'Enter the account name.' })
  @MaxLength(120, { message: 'The account name is too long.' })
  name: string;

  @IsIn(ACCOUNT_TYPES, { message: 'Choose the account type.' })
  type: AccountType;

  /** Required for expense accounts; ignored for every other type. */
  @ValidateIf((o: CoaFieldsInput) => o.type === 'expense')
  @IsIn(EXPENSE_GROUPS, { message: 'Choose the expense group.' })
  expenseGroup: ExpenseGroup | null;

  @optionalText()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'The description is too long.' })
  description: string | null;

  @optionalText()
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'The owner-facing name is too long.' })
  ownerLabel: string | null;

  @IsBoolean({
    message: 'Say whether transactions can be put in this account.',
  })
  categorizable: boolean;

  @optionalText()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'The offset account must be a 4-digit code.' })
  contraOf: string | null;
}

export class CreateCoaInput extends CoaFieldsInput {
  @trimmed()
  @Matches(/^\d{4}$/, { message: 'The code must be exactly 4 digits.' })
  code: string;
}

export class UpdateCoaInput extends CoaFieldsInput {
  @IsBoolean({ message: 'Say whether the account is active.' })
  isActive: boolean;
}
