import { HomeOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { RequireRole } from '../auth/RequireRole.tsx'
import { AppShell, type NavItem } from '../shared/AppShell.tsx'

const CLIENT_NAV: NavItem[] = [
  { to: '/client', label: 'Home', icon: <HomeOutlined /> },
  { to: '/client/questions', label: 'Questions', icon: <QuestionCircleOutlined /> },
]

/**
 * Frame for everything under /client. Only users with the client role get in.
 * Pharmacy owners mostly use phones, so the page stays narrow.
 */
export function ClientLayout() {
  return (
    <RequireRole role="client">
      <AppShell areaLabel="For your pharmacy" maxWidth={560} nav={CLIENT_NAV} />
    </RequireRole>
  )
}
