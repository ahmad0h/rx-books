import type { Request } from 'express';
import type { User, UserRole } from '../users/user.entity.js';

/** Name of the httpOnly cookie that carries the signed session token. */
export const SESSION_COOKIE = 'rx_session';

/** What the app knows about the signed-in user. Safe to send to the browser. */
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

/** Contents of the signed session token. */
export interface SessionTokenPayload {
  sub: string;
  role: UserRole;
  /** Must match the user's current session version (changes with the password). */
  ver: number;
}

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

export function toSessionUser(
  user: Pick<User, 'id' | 'email' | 'name' | 'role'>,
): SessionUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
