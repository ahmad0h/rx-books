import { RequireRole } from '../auth/RequireRole.tsx'
import { AppShell } from '../shared/AppShell.tsx'

/** Frame for everything under /admin. Only users with the admin role get in. */
export function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AppShell areaLabel="Admin console" maxWidth={1100} />
    </RequireRole>
  )
}
