import { QuestionCircleOutlined } from '@ant-design/icons'
import { Alert, Flex, Input, Modal, Select, Typography } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import { formatDay } from '../accounts/account.ts'
import { Amount } from './Amount.tsx'
import { QUESTIONS_SOFT_CAP, type AskOwnerResult, type Transaction } from './transaction.ts'

interface Props {
  pharmacyId: number
  /** The rows to ask about. */
  rows: Transaction[]
  /** Accounts staff may suggest, grouped like the category picker. */
  options: { label: string; options: { value: string; label: string }[] }[]
  /** Open questions in this month before asking. */
  openInMonth: number
  onClose: () => void
  onAsked: (result: AskOwnerResult) => void
}

interface Draft {
  suggestedCode: string | null
  note: string
}

/** Staff ask the pharmacy owner about the chosen rows, with a suggestion and a note each. */
export function AskOwnerModal({ pharmacyId, rows, options, openInMonth, onClose, onAsked }: Props) {
  const allowed = new Set(options.flatMap((g) => g.options.map((o) => o.value)))
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      rows.map((t) => [t.id, { suggestedCode: allowed.has(t.coaCode) ? t.coaCode : null, note: '' }]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = openInMonth + rows.length

  const update = (id: number, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await api<AskOwnerResult>(`/pharmacies/${pharmacyId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          items: rows.map((t) => ({
            transactionId: t.id,
            suggestedCode: drafts[t.id].suggestedCode,
            note: drafts[t.id].note,
          })),
        }),
      })
      onAsked(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the questions. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={
        <Flex gap={8} align="center">
          <QuestionCircleOutlined />
          Ask the owner about {rows.length} transaction{rows.length === 1 ? '' : 's'}
        </Flex>
      }
      okText="Ask owner"
      onOk={submit}
      confirmLoading={saving}
      onCancel={() => !saving && onClose()}
      cancelButtonProps={{ disabled: saving }}
      width={760}
    >
      <Typography.Paragraph type="secondary">
        The owner sees each transaction with your suggestion pre-selected, in plain words (no account codes). Their
        answer is only a suggestion until you accept it.
      </Typography.Paragraph>
      {total > QUESTIONS_SOFT_CAP && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`This makes ${total} open questions this month`}
          description={`We aim for about ${QUESTIONS_SOFT_CAP} a month, so owners aren't overwhelmed. You can still send them.`}
        />
      )}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Flex vertical gap={16}>
        {rows.map((t) => (
          <div key={t.id} style={{ borderBottom: '1px solid rgba(5, 5, 5, 0.06)', paddingBottom: 12 }}>
            <Flex justify="space-between" gap={12} wrap>
              <Typography.Text strong>{t.description}</Typography.Text>
              <span>
                <Typography.Text type="secondary">{formatDay(t.date)} · </Typography.Text>
                <Amount value={t.amount} />
              </span>
            </Flex>
            <Flex gap={8} wrap style={{ marginTop: 8 }}>
              <Select<string>
                allowClear
                placeholder="Suggest a category (optional)"
                value={drafts[t.id].suggestedCode ?? undefined}
                onChange={(value) => update(t.id, { suggestedCode: value ?? null })}
                showSearch={{ optionFilterProp: 'label' }}
                popupMatchSelectWidth={false}
                options={options}
                style={{ flex: '1 1 260px' }}
                disabled={saving}
              />
              <Input
                placeholder="Note for the owner (optional), e.g. Was this the staff lunch?"
                value={drafts[t.id].note}
                onChange={(e) => update(t.id, { note: e.target.value })}
                maxLength={500}
                style={{ flex: '2 1 320px' }}
                disabled={saving}
              />
            </Flex>
          </div>
        ))}
      </Flex>
    </Modal>
  )
}
