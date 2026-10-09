import { ExperimentOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Input, Space, Tag, Typography } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { Rule, RuleTestResult } from './rule.ts'

interface Props {
  /** Pharmacy whose rules are tried first; null = shared rules only. */
  pharmacyId: number | null
  listName: string
}

function RuleLine({ rule }: { rule: Rule }) {
  return (
    <Space size={6} wrap>
      <Typography.Text code>{rule.keyword}</Typography.Text>→<Typography.Text strong>{rule.account}</Typography.Text>
      <Tag>{rule.pharmacyId === null ? 'Shared' : 'Pharmacy'}</Tag>
      <Typography.Text type="secondary">priority {rule.priority}</Typography.Text>
    </Space>
  )
}

/** Paste a bank description and see which rule would categorize it, and why. */
export function RuleTestBox({ pharmacyId, listName }: Props) {
  const [description, setDescription] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ description: string; data: RuleTestResult } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!description.trim()) return
    setTesting(true)
    setError(null)
    try {
      const data = await api<RuleTestResult>('/rules/test', {
        method: 'POST',
        body: JSON.stringify({ description, pharmacyId }),
      })
      setResult({ description: description.trim(), data })
    } catch (err) {
      setResult(null)
      setError(err instanceof ApiError ? err.message : 'Could not run the test.')
    } finally {
      setTesting(false)
    }
  }

  const winner = result?.data.winner
  const others = result?.data.matches.slice(1) ?? []

  return (
    <Card
      size="small"
      title={
        <Space>
          <ExperimentOutlined />
          Test a bank description
        </Space>
      }
      extra={<Typography.Text type="secondary">{listName}</Typography.Text>}
      style={{ marginBottom: 16 }}
    >
      <Flex gap={8} wrap>
        <Input
          allowClear
          placeholder="e.g. ELECTRONIC WITHDRAWAL MCKESSON"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            if (!e.target.value) setResult(null)
          }}
          onPressEnter={run}
          style={{ flex: '1 1 320px' }}
        />
        <Button type="primary" onClick={run} loading={testing} disabled={!description.trim()}>
          Test
        </Button>
      </Flex>

      {error && <Alert type="error" showIcon title={error} style={{ marginTop: 12 }} />}

      {result &&
        (winner ? (
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 12 }}
            title={<RuleLine rule={winner} />}
            description={
              <>
                <div>
                  {winner.autoApprove
                    ? 'Categorized automatically.'
                    : 'Suggested — staff confirm it (auto-approve is off).'}{' '}
                  {winner.pharmacyId !== null
                    ? 'Pharmacy rules run before shared ones.'
                    : pharmacyId !== null
                      ? 'No pharmacy rule matched, so the shared rules decided.'
                      : ''}
                </div>
                {others.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">Also matched, but lost:</Typography.Text>
                    {others.map((rule) => (
                      <div key={rule.id}>
                        <RuleLine rule={rule} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            }
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            title="No rule matches"
            description="This row would go to AI suggestions, and stay in 9999 · Uncategorized until someone decides."
          />
        ))}
    </Card>
  )
}
