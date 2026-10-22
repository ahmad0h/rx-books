import { Typography } from 'antd'
import { useSignedInUser } from '../auth/useAuth.ts'

export function AdminHomePage() {
  const user = useSignedInUser()
  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name}</Typography.Title>
      <Typography.Paragraph type="secondary">
       
      </Typography.Paragraph>
      <div style={{ maxWidth: 520 }}>
        {/* <SystemStatus /> */}
      </div>
    </>
  )
}
