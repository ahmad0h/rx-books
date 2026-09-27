import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  toSessionUser,
  type SessionTokenPayload,
  type SessionUser,
} from './session-user.js';

/** One message for every failed sign-in, so it never reveals which emails exist. */
export const INVALID_CREDENTIALS = 'Email or password is incorrect.';
export const WRONG_CURRENT_PASSWORD = 'Your current password is incorrect.';
export const SAME_PASSWORD =
  'Choose a new password that is different from your current one.';

@Injectable()
export class AuthService {
  /** Checked against when the email is unknown, so failed sign-ins take the same time. */
  private readonly timingHash = hashPassword('rxbooks-timing-equaliser');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ user: SessionUser; token: string }> {
    const user = await this.users.findByEmailWithPassword(email);
    const passwordOk = await verifyPassword(
      user?.passwordHash ?? (await this.timingHash),
      password,
    );

    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.users.recordLogin(user.id);
    return {
      user: toSessionUser(user),
      token: await this.issueToken(user, user.sessionVersion),
    };
  }

  /**
   * Changes the signed-in user's password. All other sessions end; the caller
   * gets a fresh token so the current session continues.
   */
  async changePassword(
    user: SessionUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<string> {
    const stored = await this.users.findByIdWithPassword(user.id);
    if (!stored?.isActive) throw new UnauthorizedException('Please sign in.');

    if (!(await verifyPassword(stored.passwordHash, currentPassword))) {
      throw new BadRequestException(WRONG_CURRENT_PASSWORD);
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException(SAME_PASSWORD);
    }

    const sessionVersion = await this.users.changePassword(stored, newPassword);
    return this.issueToken(user, sessionVersion);
  }

  private issueToken(
    user: Pick<SessionUser, 'id' | 'role'>,
    sessionVersion: number,
  ): Promise<string> {
    const payload: SessionTokenPayload = {
      sub: String(user.id),
      role: user.role,
      ver: sessionVersion,
    };
    return this.jwt.signAsync(payload);
  }

  /**
   * Turns a session token back into a user. The user is re-read from the
   * database, so a deactivated account or a password change ends older
   * sessions immediately.
   */
  async userFromToken(token: string): Promise<SessionUser | null> {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionTokenPayload>(token);
    } catch {
      return null;
    }
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const user = await this.users.findById(id);
    if (!user?.isActive || payload.ver !== user.sessionVersion) return null;
    return toSessionUser(user);
  }
}
