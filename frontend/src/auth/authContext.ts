import { createContext } from 'react'
import type { SessionUser } from './types.ts'

export interface AuthContextValue {
  /** 'loading' until the app has asked the backend who is signed in. */
  status: 'loading' | 'ready'
  user: SessionUser | null
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
