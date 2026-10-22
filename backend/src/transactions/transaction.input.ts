import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** About 2 MB of text: a busy account's month is far smaller. */
export const MAX_FILE_CHARS = 2_000_000;

/** A bank CSV sent as text, for preview or import. */
export class UploadFileInput {
  @IsInt({ message: 'Choose the account.' })
  @Min(1, { message: 'Choose the account.' })
  accountId: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'The file needs a name.' })
  @MinLength(1, { message: 'The file needs a name.' })
  @MaxLength(255, { message: 'The file name is too long.' })
  fileName: string;

  @IsString({ message: 'Choose a CSV file.' })
  @MinLength(1, { message: 'The file is empty.' })
  @MaxLength(MAX_FILE_CHARS, {
    message: 'The file is too large (2 MB at most).',
  })
  content: string;
}

/** ?month=2025-01&accountId=3 */
export class TransactionsQuery {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use a month like 2025-01.' })
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose an account.' })
  accountId?: number;
}

/** A person chooses the account. 9999 puts the row back to uncategorized. */
export class SetAccountInput {
  @Matches(/^\d{4}$/, { message: 'Choose the account.' })
  coaCode: string;
}

/** Several transactions at once, e.g. to approve them. */
export class TransactionIdsInput {
  @IsArray({ message: 'Choose the transactions.' })
  @ArrayMinSize(1, { message: 'Choose at least one transaction.' })
  @ArrayMaxSize(1000, {
    message: 'Choose at most 1000 transactions at a time.',
  })
  @IsInt({ each: true, message: 'Choose the transactions.' })
  ids: number[];
}

/** Run the rules again on one month (and optionally one account). */
export class CategorizeInput {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use a month like 2025-01.' })
  month: string;

  @IsOptional()
  @IsInt({ message: 'Choose an account.' })
  accountId?: number;
}
