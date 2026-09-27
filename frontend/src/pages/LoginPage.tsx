import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { homePathFor, type SessionUser } from '../auth/types.ts'
import { useAuth } from '../auth/useAuth.ts'
import { ApiError } from '../shared/api.ts'
import { FullPageSpinner } from '../shared/FullPageSpinner.tsx'
import { brand } from '../theme.ts'

interface LoginForm {
  email: string
  password: string
}

/** After sign-in, go back to the page that asked for it, if it belongs to this user's area. */
function destinationFor(user: SessionUser, from: unknown): string {
  const home = homePathFor(user.role)
  return typeof from === 'string' && from.startsWith(home) ? from : home
}

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') return <FullPageSpinner />
  if (user) return <Navigate to={destinationFor(user, from)} replace />

  const onFinish = async ({ email, password }: LoginForm) => {
    setError(null)
    setSubmitting(true)
    try {
      const signedIn = await login(email, password)
      navigate(destinationFor(signedIn, from), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Flex justify="center" style={{ minHeight: '100vh', padding: '12vh 16px 32px', background: brand.paper }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={2} style={{ textAlign: 'center', marginBottom: 4 }}>
          <span style={{ color: brand.green }}>Rx</span>Books
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24 }}>
          Bookkeeping for independent pharmacies
        </Typography.Paragraph>

        <Card>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Sign in
          </Typography.Title>

          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

          <Form<LoginForm> layout="vertical" requiredMark={false} onFinish={onFinish} disabled={submitting}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Enter your email address.' },
                { type: 'email', message: 'Enter a valid email address.' },
              ]}
            >
              <Input prefix={<MailOutlined />} type="email" autoComplete="username" autoFocus size="large" />
            </Form.Item>

            <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Enter your password.' }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
              Sign in
            </Button>
          </Form>
        </Card>

        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          Staff and pharmacy owners use the same sign-in.
        </Typography.Paragraph>
      </div>
    </Flex>
  )
}
