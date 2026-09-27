import { IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 12;

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Enter your current password.' })
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
  })
  @MaxLength(200, { message: 'Your new password is too long.' })
  newPassword: string;
}
