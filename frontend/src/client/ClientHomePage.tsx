import { Card, Typography } from 'antd'
import { useSignedInUser } from '../auth/useAuth.ts'

export function ClientHomePage() {
  const user = useSignedInUser()
  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name}</Typography.Title>
      <Card>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Your questions and monthly reports will appear here. There's nothing to do yet.
        </Typography.Paragraph>
      </Card>
    </>
  )
}
