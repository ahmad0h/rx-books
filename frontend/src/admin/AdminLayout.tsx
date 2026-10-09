import { BookOutlined, DashboardOutlined, ShopOutlined } from '@ant-design/icons'
import { RequireRole } from '../auth/RequireRole.tsx'
import { AppShell, type NavItem } from '../shared/AppShell.tsx'

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <DashboardOutlined /> },
  { to: '/admin/pharmacies', label: 'Pharmacies', icon: <ShopOutlined /> },
  { to: '/admin/chart-of-accounts', label: 'Chart of accounts', icon: <BookOutlined /> },
]

/** Frame for everything under /admin. Only users with the admin role get in. */
export function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AppShell areaLabel="Admin console" maxWidth={1440} nav={ADMIN_NAV} />
    </RequireRole>
  )
}
