import { QuestionCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Typography } from 'antd'
import { Link } from 'react-router'
import { useSignedInUser } from '../auth/useAuth.ts'
import { useOwnerQuestions } from './questions/useOwnerQuestions.ts'

export function ClientHomePage() {
  const user = useSignedInUser()
  const { state } = useOwnerQuestions()
  const left =
    state.status === 'ready' ? state.questions.filter((q) => q.status === 'waiting').length : 0

  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name}</Typography.Title>
      {state.status === 'error' && <Alert type="warning" showIcon title={state.message} style={{ marginBottom: 16 }} />}
      <Card>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          <QuestionCircleOutlined /> Questions
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: left > 0 ? 12 : 0 }}>
          {state.status === 'loading'
            ? 'Checking…'
            : left > 0
              ? `We have ${left} question${left === 1 ? '' : 's'} for you about recent transactions.`
              : "You're all caught up. Monthly reports will appear here too."}
        </Typography.Paragraph>
        {left > 0 && (
          <Link to="/client/questions">
            <Button type="primary" size="large" block>
              Answer {left === 1 ? 'it' : 'them'} now
            </Button>
          </Link>
        )}
      </Card>
    </>
  )
}
