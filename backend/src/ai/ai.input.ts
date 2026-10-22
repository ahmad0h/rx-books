import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The rows a person ticked and sent to AI. */
export class AskAiInput {
  @IsArray({ message: 'Choose the transactions.' })
  @ArrayMinSize(1, { message: 'Choose at least one transaction.' })
  @ArrayMaxSize(200, { message: 'Choose at most 200 transactions at a time.' })
  @IsInt({ each: true, message: 'Choose the transactions.' })
  ids: number[];
}

/** A new version of the AI instructions. */
export class SavePromptInput {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Write the instructions.' })
  @MinLength(50, { message: 'The instructions are too short.' })
  @MaxLength(20000, {
    message: 'The instructions are too long (20,000 characters at most).',
  })
  body: string;
}

/** ?pharmacyId=1 */
export class AiRunsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose a pharmacy.' })
  pharmacyId?: number;
}
