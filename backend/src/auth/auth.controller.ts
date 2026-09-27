import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import type { AppEnv } from '../config/env.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './change-password.dto.js';
import { CurrentUser, Public } from './decorators.js';
import { LoginDto } from './login.dto.js';
import { SESSION_COOKIE, type SessionUser } from './session-user.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  /** POST /api/auth/login — sets the session cookie. At most 5 attempts per minute. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const { user, token } = await this.auth.login(body.email, body.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  /**
   * POST /api/auth/change-password — for the signed-in user. Ends the user's
   * other sessions and renews this one. At most 5 attempts per minute.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.auth.changePassword(
      user,
      body.currentPassword,
      body.newPassword,
    );
    this.setSessionCookie(res, token);
  }

  /** POST /api/auth/logout — clears the session cookie. Works even if the session already expired. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  /** GET /api/auth/me — the signed-in user, or 401. */
  @Get('me')
  me(@CurrentUser() user: SessionUser): { user: SessionUser } {
    return { user };
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge:
        this.config.get('SESSION_HOURS', { infer: true }) * 60 * 60 * 1000,
    });
  }

  /**
   * httpOnly: page scripts can't read the token. SameSite=Strict: other sites
   * can't send it. Path=/api: only sent to the API.
   */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      path: '/api',
    };
  }
}
