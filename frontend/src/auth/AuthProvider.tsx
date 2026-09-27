import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../shared/api.ts'
import { AuthContext, type AuthContextValue } from './authContext.ts'
import type { SessionUser } from './types.ts'

/** Keeps track of who is signed in. The session itself lives in an httpOnly cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)

  // On start-up, ask the backend whether a session already exists.
  useEffect(() => {
    let cancelled = false
    api<{ user: SessionUser }>('/auth/me')
      .then(({ user }) => {
        if (!cancelled) setUser(user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, logout }), [status, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
