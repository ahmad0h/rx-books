import { SmileOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Progress, Result, Skeleton, Typography } from 'antd'
import { QuestionCard } from './QuestionCard.tsx'
import { useOwnerQuestions } from './useOwnerQuestions.ts'

/** The owner's open questions, one card each. Answers save as soon as they confirm. */
export function QuestionsPage() {
  const { state, reload } = useOwnerQuestions()

  if (state.status === 'loading') return <Skeleton active />
  if (state.status === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        title={state.message}
        action={
          <Button size="small" onClick={reload}>
            Try again
          </Button>
        }
      />
    )
  }

  const { questions, categories, pharmacyName } = state
  const done = questions.filter((q) => q.status === 'answered').length
  const left = questions.length - done

  return (
    <>
      <Typography.Text type="secondary" style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>
        {pharmacyName}
      </Typography.Text>
      <Typography.Title level={3} style={{ marginTop: 4 }}>
        Questions
      </Typography.Title>

      {questions.length === 0 ? (
        <Result icon={<SmileOutlined />} title="All caught up" subTitle="There's nothing we need from you right now." />
      ) : (
        <>
          <Typography.Paragraph>
            We need your help with a few transactions to close your books. Choose what each one was for, add detail if
            it helps, then confirm. You can change an answer until we've reviewed it.
          </Typography.Paragraph>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Flex justify="space-between" align="center">
              <Typography.Text strong>
                {left > 0 ? `${left} left to answer` : 'All answered, thank you!'}
              </Typography.Text>
              <Typography.Text type="secondary">
                {done} of {questions.length} done
              </Typography.Text>
            </Flex>
            <Progress percent={Math.round((done / questions.length) * 100)} showInfo={false} size="small" />
          </Card>
          <Flex vertical gap={12}>
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                position={`Item ${i + 1} of ${questions.length}`}
                categories={categories}
                onSaved={reload}
              />
            ))}
          </Flex>
        </>
      )}
    </>
  )
}
