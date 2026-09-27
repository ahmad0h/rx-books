export type Role = 'admin' | 'client'

/** The signed-in user, as returned by /api/auth/me. */
export interface SessionUser {
  id: number
  email: string
  name: string
  role: Role
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role): string {
  return role === 'admin' ? '/admin' : '/client'
}
