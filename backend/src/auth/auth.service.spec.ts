import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UsersService } from '../users/users.service.js';
import {
  AuthService,
  INVALID_CREDENTIALS,
  SAME_PASSWORD,
  WRONG_CURRENT_PASSWORD,
} from './auth.service.js';
import { hashPassword, verifyPassword } from './password.js';

async function setup(overrides: { isActive?: boolean } = {}) {
  const stored = {
    id: 7,
    email: 'owner@rxbooks.test',
    name: 'Owner',
    role: 'client' as const,
    isActive: overrides.isActive ?? true,
    sessionVersion: 0,
    passwordHash: await hashPassword('correct-password'),
  };
  const users = {
    findByEmailWithPassword: vi.fn((email: string) =>
      Promise.resolve(email === stored.email ? { ...stored } : null),
    ),
    findByIdWithPassword: vi.fn((id: number) =>
      Promise.resolve(id === stored.id ? { ...stored } : null),
    ),
    findById: vi.fn((id: number) =>
      Promise.resolve(id === stored.id ? { ...stored } : null),
    ),
    recordLogin: vi.fn(() => Promise.resolve()),
    changePassword: vi.fn(
      async (user: { sessionVersion: number }, newPassword: string) => {
        stored.passwordHash = await hashPassword(newPassword);
        stored.sessionVersion = user.sessionVersion + 1;
        return stored.sessionVersion;
      },
    ),
  };
  const jwt = new JwtService({
    secret: 'x'.repeat(32),
    signOptions: { algorithm: 'HS256', issuer: 'rxbooks', expiresIn: 3600 },
    verifyOptions: { algorithms: ['HS256'], issuer: 'rxbooks' },
  });
  return {
    service: new AuthService(users as unknown as UsersService, jwt),
    users,
    stored,
  };
}

describe('AuthService', () => {
  describe('login', () => {
    it('signs in with the right password and returns a token that maps back to the user', async () => {
      const { service, users } = await setup();
      const { user, token } = await service.login(
        'owner@rxbooks.test',
        'correct-password',
      );

      expect(user).toEqual({
        id: 7,
        email: 'owner@rxbooks.test',
        name: 'Owner',
        role: 'client',
      });
      expect(users.recordLogin).toHaveBeenCalledWith(7);
      expect(await service.userFromToken(token)).toEqual(user);
    });

    it.each([
      ['a wrong password', 'owner@rxbooks.test', 'wrong-password'],
      ['an unknown email', 'nobody@rxbooks.test', 'correct-password'],
    ])(
      'rejects %s with the generic message',
      async (_case, email, password) => {
        const { service, users } = await setup();
        await expect(service.login(email, password)).rejects.toThrow(
          new UnauthorizedException(INVALID_CREDENTIALS),
        );
        expect(users.recordLogin).not.toHaveBeenCalled();
      },
    );

    it('rejects a deactivated account', async () => {
      const { service } = await setup({ isActive: false });
      await expect(
        service.login('owner@rxbooks.test', 'correct-password'),
      ).rejects.toThrow(INVALID_CREDENTIALS);
    });
  });

  describe('userFromToken', () => {
    it('returns no user for a forged or garbage token', async () => {
      const { service } = await setup();
      const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync(
        { sub: '7', role: 'admin', ver: 0 },
      );
      expect(await service.userFromToken(forged)).toBeNull();
      expect(await service.userFromToken('garbage')).toBeNull();
    });

    it('drops the session once the account is deactivated', async () => {
      const { service, users, stored } = await setup();
      const { token } = await service.login(
        'owner@rxbooks.test',
        'correct-password',
      );
      users.findById.mockResolvedValueOnce({ ...stored, isActive: false });
      expect(await service.userFromToken(token)).toBeNull();
    });
  });

  describe('changePassword', () => {
    const owner = {
      id: 7,
      email: 'owner@rxbooks.test',
      name: 'Owner',
      role: 'client' as const,
    };

    it('saves the new password, ends old sessions and returns a working new token', async () => {
      const { service, stored } = await setup();
      const { token: oldToken } = await service.login(
        owner.email,
        'correct-password',
      );

      const newToken = await service.changePassword(
        owner,
        'correct-password',
        'brand-new-password',
      );

      expect(
        await verifyPassword(stored.passwordHash, 'brand-new-password'),
      ).toBe(true);
      expect(await service.userFromToken(oldToken)).toBeNull();
      expect(await service.userFromToken(newToken)).toEqual(owner);
    });

    it('rejects a wrong current password and changes nothing', async () => {
      const { service, users } = await setup();
      await expect(
        service.changePassword(owner, 'wrong-password', 'brand-new-password'),
      ).rejects.toThrow(new BadRequestException(WRONG_CURRENT_PASSWORD));
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it('rejects a new password equal to the current one', async () => {
      const { service, users } = await setup();
      await expect(
        service.changePassword(owner, 'correct-password', 'correct-password'),
      ).rejects.toThrow(new BadRequestException(SAME_PASSWORD));
      expect(users.changePassword).not.toHaveBeenCalled();
    });
  });
});
