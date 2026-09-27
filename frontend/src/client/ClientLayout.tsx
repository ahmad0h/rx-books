import { RequireRole } from '../auth/RequireRole.tsx'
import { AppShell } from '../shared/AppShell.tsx'

/**
 * Frame for everything under /client. Only users with the client role get in.
 * Pharmacy owners mostly use phones, so the page stays narrow.
 */
export function ClientLayout() {
  return (
    <RequireRole role="client">
      <AppShell areaLabel="For your pharmacy" maxWidth={560} />
    </RequireRole>
  )
}
