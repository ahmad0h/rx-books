import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { UserRole } from '../users/user.entity.js';
import { RolesGuard } from './roles.guard.js';

function check(requiredRoles: UserRole[] | undefined, userRole?: UserRole) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  const request = {
    user: userRole
      ? { id: 1, email: 'a@b.test', name: 'A', role: userRole }
      : undefined,
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return () => new RolesGuard(reflector).canActivate(context);
}

describe('RolesGuard', () => {
  it('allows routes without @Roles', () => {
    expect(check(undefined, 'client')()).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    expect(check(['admin'], 'admin')()).toBe(true);
  });

  it('blocks a user whose role is not listed', () => {
    expect(check(['admin'], 'client')).toThrow(ForbiddenException);
  });

  it('blocks when there is no signed-in user', () => {
    expect(check(['client'])).toThrow(ForbiddenException);
  });
});
