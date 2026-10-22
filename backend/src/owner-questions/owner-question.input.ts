import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Trims; an empty string becomes null. */
const optionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

export class AskItemInput {
  @IsInt({ message: 'Choose the transactions.' })
  transactionId: number;

  /** Staff's best guess, shown to the owner as the starting choice. */
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Choose a suggested category.' })
  suggestedCode?: string | null;

  @optionalText()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'The note for the owner is too long.' })
  note?: string | null;
}

/** Staff ask the owner about several transactions at once. */
export class AskOwnerInput {
  @IsArray({ message: 'Choose the transactions.' })
  @ArrayMinSize(1, { message: 'Choose at least one transaction.' })
  @ArrayMaxSize(50, { message: 'Ask about at most 50 transactions at a time.' })
  @ValidateNested({ each: true })
  @Type(() => AskItemInput)
  items: AskItemInput[];
}

/** The owner's answer. `category` is a code, or "unsure" for "Not sure, you decide". */
export class AnswerInput {
  @Matches(/^(\d{4}|unsure)$/, { message: 'Choose a category, or "Not sure".' })
  category: string;

  @optionalText()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'The note is too long.' })
  note?: string | null;

  @IsBoolean({ message: 'Say whether you will send a document.' })
  willSendDocument: boolean;
}
