import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { normalizeText } from './matcher.js';

const keyword = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeText(value) : value,
  );

/** Trims; an empty string becomes null. */
const optionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

/** The parts of a rule a person sets. */
export class RuleFieldsInput {
  @keyword()
  @IsString({ message: 'Enter the keyword.' })
  @MinLength(3, { message: 'The keyword must be at least 3 characters.' })
  @MaxLength(120, { message: 'The keyword is too long.' })
  keyword: string;

  @Matches(/^\d{4}$/, { message: 'Choose the account.' })
  coaCode: string;

  @optionalText()
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,60}$/, {
    message: 'A tag can use letters, numbers, - and _ only (no spaces).',
  })
  tag?: string | null;

  /** Optional: a new rule goes after the last one in its list. */
  @IsOptional()
  @IsInt({ message: 'The priority must be a whole number.' })
  @Min(1, { message: 'The priority must be between 1 and 99999.' })
  @Max(99999, { message: 'The priority must be between 1 and 99999.' })
  priority?: number | null;

  @IsBoolean({ message: 'Say whether matches are approved automatically.' })
  autoApprove: boolean;

  @optionalText()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'The note is too long.' })
  sourceNote?: string | null;
}

export class CreateRuleInput extends RuleFieldsInput {
  /** null = shared rule for every pharmacy. */
  @ValidateIf((o: CreateRuleInput) => o.pharmacyId !== null)
  @IsInt({ message: 'Choose the pharmacy, or make it a shared rule.' })
  pharmacyId: number | null;
}

/** Editing never moves a rule between pharmacies. */
export class UpdateRuleInput extends RuleFieldsInput {}

/** The test box: which rule would categorize this bank description? */
export class TestRulesInput {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Enter a bank description to test.' })
  @MinLength(1, { message: 'Enter a bank description to test.' })
  @MaxLength(500, { message: 'The description is too long.' })
  description: string;

  /** Missing or null = test shared rules only. */
  @IsOptional()
  @IsInt({ message: 'Choose the pharmacy.' })
  pharmacyId?: number | null;
}
