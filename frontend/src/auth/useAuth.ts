import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContext.ts'
import type { SessionUser } from './types.ts'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** For pages behind <RequireRole>, where a user is always signed in. */
export function useSignedInUser(): SessionUser {
  const { user } = useAuth()
  if (!user) throw new Error('useSignedInUser used on a page without <RequireRole>')
  return user
}
