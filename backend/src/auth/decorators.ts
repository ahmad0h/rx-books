import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { UserRole } from '../users/user.entity.js';
import type { AuthenticatedRequest, SessionUser } from './session-user.js';

export const IS_PUBLIC_KEY = 'rx:isPublic';
export const ROLES_KEY = 'rx:roles';

/** Route can be called without signing in. Every other route requires a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Route is limited to these roles, e.g. @Roles('admin'). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the signed-in user into a route handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
