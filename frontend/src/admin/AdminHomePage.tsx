import { Typography } from 'antd'
import { useSignedInUser } from '../auth/useAuth.ts'
import { SystemStatus } from '../shared/health/SystemStatus.tsx'

export function AdminHomePage() {
  const user = useSignedInUser()
  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name}</Typography.Title>
      <Typography.Paragraph type="secondary">
        Nothing here yet. Admin features are added phase by phase.
      </Typography.Paragraph>
      <div style={{ maxWidth: 520 }}>
        <SystemStatus />
      </div>
    </>
  )
}
