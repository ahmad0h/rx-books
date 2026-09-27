import { Navigate } from 'react-router'
import { homePathFor } from '../auth/types.ts'
import { useAuth } from '../auth/useAuth.ts'
import { FullPageSpinner } from '../shared/FullPageSpinner.tsx'

/** "/" sends signed-in users to their area and everyone else to the sign-in page. */
export function RootRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
