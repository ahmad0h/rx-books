import { MenuOutlined } from '@ant-design/icons'
import { Button, Layout, Menu } from 'antd'
import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { brand } from '../theme.ts'
import { UserMenu } from './UserMenu.tsx'

const { Header, Sider, Content, Footer } = Layout

export interface NavItem {
  to: string
  label: string
  icon?: ReactNode
}

interface AppShellProps {
  /** Shown next to the logo, e.g. "Admin console". */
  areaLabel: string
  /** Page width: wide for staff screens, narrow for the phone-first client area. */
  maxWidth: number
  /** Page links, shown in a left-hand menu. No menu when empty. */
  nav?: NavItem[]
}

/** The nav item for the current page: the longest link the path starts with. */
function activeNav(nav: NavItem[], pathname: string): string[] {
  const match = nav
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match ? [match.to] : []
}

/** Common page frame: header with the user menu, optional left menu, content, footer. */
export function AppShell({ areaLabel, maxWidth, nav = [] }: AppShellProps) {
  const { pathname } = useLocation()
  // On small screens the left menu starts hidden and closes after a page is chosen.
  const [narrow, setNarrow] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 12, paddingInline: 16 }}>
        {nav.length > 0 && narrow && (
          <Button
            type="text"
            aria-label={collapsed ? 'Open menu' : 'Close menu'}
            icon={<MenuOutlined />}
            onClick={() => setCollapsed((c) => !c)}
            style={{ color: '#fff', marginLeft: -8 }}
          />
        )}
        <Link to="/" style={{ color: '#fff', fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span style={{ color: brand.green }}>Rx</span>Books
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, whiteSpace: 'nowrap' }}>{areaLabel}</span>
        <div style={{ flex: 1 }} />
        <UserMenu />
      </Header>

      <Layout>
        {nav.length > 0 && (
          <Sider
            theme="light"
            width={220}
            breakpoint="lg"
            collapsedWidth={0}
            collapsed={collapsed}
            trigger={null}
            onBreakpoint={(broken) => {
              setNarrow(broken)
              setCollapsed(broken)
            }}
            // Narrow screens: the menu slides over the page instead of squeezing it.
            style={
              narrow
                ? {
                    position: 'fixed',
                    top: 64,
                    bottom: 0,
                    left: 0,
                    zIndex: 20,
                    boxShadow: collapsed ? 'none' : '0 6px 16px rgba(0,0,0,0.12)',
                  }
                : { borderRight: '1px solid rgba(5, 5, 5, 0.06)' }
            }
          >
            <Menu
              mode="inline"
              selectedKeys={activeNav(nav, pathname)}
              items={nav.map((item) => ({
                key: item.to,
                icon: item.icon,
                label: <Link to={item.to}>{item.label}</Link>,
              }))}
              onClick={() => narrow && setCollapsed(true)}
              style={{ borderInlineEnd: 'none', paddingTop: 8 }}
            />
          </Sider>
        )}

        {narrow && !collapsed && (
          // Tap outside the open menu to close it.
          <div
            onClick={() => setCollapsed(true)}
            style={{ position: 'fixed', inset: '64px 0 0 0', zIndex: 19, background: 'rgba(0,0,0,0.25)' }}
          />
        )}

        <Layout>
          <Content style={{ padding: '32px 24px', width: '100%', maxWidth, margin: '0 auto' }}>
            <Outlet />
          </Content>
          <Footer style={{ textAlign: 'center', color: '#8c8c8c' }}>RxBooks · {areaLabel}</Footer>
        </Layout>
      </Layout>
    </Layout>
  )
}
