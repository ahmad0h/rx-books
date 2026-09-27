import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '../shared/FullPageSpinner.tsx'
import { homePathFor, type Role } from './types.ts'
import { useAuth } from './useAuth.ts'

/**
 * Shows its children only to a signed-in user with the given role.
 * Not signed in: sends them to /login. Wrong role: sends them to their own area.
 * (The backend enforces the same rules; this only keeps the screens tidy.)
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return children
}
