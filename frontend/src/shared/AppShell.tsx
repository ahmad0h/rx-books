import { Layout } from 'antd'
import { Link, Outlet } from 'react-router'
import { brand } from '../theme.ts'
import { UserMenu } from './UserMenu.tsx'

const { Header, Content, Footer } = Layout

interface AppShellProps {
  /** Shown next to the logo, e.g. "Admin console". */
  areaLabel: string
  /** Page width: wide for staff screens, narrow for the phone-first client area. */
  maxWidth: number
}

/** Common page frame for every area: header with the user menu, content, footer. */
export function AppShell({ areaLabel, maxWidth }: AppShellProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 12, paddingInline: 16 }}>
        <Link to="/" style={{ color: '#fff', fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span style={{ color: brand.green }}>Rx</span>Books
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, whiteSpace: 'nowrap' }}>{areaLabel}</span>
        <div style={{ flex: 1 }} />
        <UserMenu />
      </Header>

      <Content style={{ padding: '32px 16px', width: '100%', maxWidth, margin: '0 auto' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', color: '#8c8c8c' }}>RxBooks · {areaLabel}</Footer>
    </Layout>
  )
}
