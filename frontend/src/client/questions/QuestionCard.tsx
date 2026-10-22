import { CheckCircleFilled, PaperClipOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Flex, Input, Select, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import { UNSURE, type OwnerCategory, type OwnerQuestionCard } from './question.ts'

interface Props {
  question: OwnerQuestionCard
  /** "Item 2 of 7" */
  position: string
  categories: OwnerCategory[]
  onSaved: () => void
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** One transaction the owner is asked about: pick a category, add a note, confirm. */
export function QuestionCard({ question, position, categories, onSaved }: Props) {
  const answered = question.status === 'answered' && question.answer
  const [editing, setEditing] = useState(!answered)
  const [category, setCategory] = useState<string | undefined>(
    question.answer?.category ?? question.suggested ?? undefined,
  )
  const [note, setNote] = useState(question.answer?.note ?? '')
  const [willSend, setWillSend] = useState(question.answer?.willSendDocument ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    const groups = [...new Set(categories.map((c) => c.group))]
    return [
      { value: UNSURE, label: 'Not sure — you decide' },
      ...groups.map((group) => ({
        label: group,
        options: categories.filter((c) => c.group === group).map((c) => ({ value: c.value, label: c.label })),
      })),
    ]
  }, [categories])
  const labelOf = (value: string | undefined) =>
    value === UNSURE ? 'Not sure — you decide' : (categories.find((c) => c.value === value)?.label ?? '')

  const confirm = async () => {
    if (!category) return
    setSaving(true)
    setError(null)
    try {
      await api(`/client/questions/${question.id}`, {
        method: 'PUT',
        body: JSON.stringify({ category, note, willSendDocument: willSend }),
      })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your answer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const amount = Number(question.amount)
  return (
    <Card size="small" style={{ borderColor: editing ? undefined : 'rgba(23, 168, 124, 0.45)' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {position}
      </Typography.Text>
      <Flex justify="space-between" align="baseline" gap={12} style={{ marginTop: 2 }}>
        <Typography.Text strong style={{ fontSize: 16 }}>
          {question.description}
        </Typography.Text>
        <Typography.Text strong style={{ fontSize: 16, whiteSpace: 'nowrap' }}>
          {amount < 0 ? '−' : '+'}
          {usd.format(Math.abs(amount))}
        </Typography.Text>
      </Flex>
      <Typography.Text type="secondary">
        {formatDate(question.date)}
        {question.account ? ` · ${question.account}` : ''}
      </Typography.Text>

      {question.note && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(23, 168, 124, 0.07)' }}>
          <Typography.Text>{question.note}</Typography.Text>
        </div>
      )}

      {editing ? (
        <Flex vertical gap={10} style={{ marginTop: 12 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              What was this for?{question.suggested ? ' (Our best guess is selected; change it if it\'s wrong.)' : ''}
            </Typography.Text>
            <Select<string>
              value={category}
              onChange={setCategory}
              placeholder="Choose what this was for"
              options={options}
              showSearch={{ optionFilterProp: 'label' }}
              style={{ width: '100%', marginTop: 4 }}
              size="large"
              disabled={saving}
            />
          </div>
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional), e.g. staff holiday lunch for 6 people"
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={1000}
            disabled={saving}
          />
          <Checkbox checked={willSend} onChange={(e) => setWillSend(e.target.checked)} disabled={saving}>
            <PaperClipOutlined /> I'll send a receipt or document for this
          </Checkbox>
          {error && <Alert type="error" showIcon title={error} />}
          <Button type="primary" size="large" block onClick={confirm} loading={saving} disabled={!category}>
            Confirm
          </Button>
        </Flex>
      ) : (
        <Flex justify="space-between" align="center" gap={12} wrap style={{ marginTop: 12 }}>
          <span>
            <CheckCircleFilled style={{ color: '#17A87C', marginRight: 6 }} />
            <Typography.Text strong>{labelOf(category)}</Typography.Text>
            {note && <Typography.Text type="secondary"> · {note}</Typography.Text>}
            {willSend && <Typography.Text type="secondary"> · document to follow</Typography.Text>}
          </span>
          <Button size="small" type="link" onClick={() => setEditing(true)}>
            Change
          </Button>
        </Flex>
      )}
    </Card>
  )
}
