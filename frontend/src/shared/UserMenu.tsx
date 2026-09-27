import { DownOutlined, KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Dropdown, type MenuProps } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChangePasswordModal } from '../auth/ChangePasswordModal.tsx'
import { useAuth } from '../auth/useAuth.ts'

/** Top-right menu: who is signed in, change password, sign out. */
export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [changingPassword, setChangingPassword] = useState(false)

  if (!user) return null

  const items: MenuProps['items'] = [
    {
      key: 'account',
      disabled: true,
      label: (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>{user.email}</div>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'password', icon: <KeyOutlined />, label: 'Change password' },
    { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out' },
  ]

  const onClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'password') setChangingPassword(true)
    if (key === 'signout') {
      await logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <>
      <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
        <Button
          type="text"
          icon={<UserOutlined />}
          style={{ color: 'rgba(255,255,255,0.9)', maxWidth: '55vw', minWidth: 0 }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
          <DownOutlined style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>
      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  )
}
