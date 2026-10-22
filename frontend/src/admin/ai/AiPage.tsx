import { HistoryOutlined, RobotOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Flex, Input, Select, Space, Table, Tag, Typography, type TableProps } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import { CellNote } from '../../shared/CellNote.tsx'
import { usePharmacies } from '../pharmacies/usePharmacies.ts'
import { useAiStatus } from '../pharmacies/transactions/useAiStatus.ts'
import type { AiRun, PromptVersion } from './ai.ts'

const when = (at: string) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Admin → AI: is it set up, the instructions (versioned), and every run with its cost. */
export function AiPage() {
  const status = useAiStatus()
  const pharmacies = usePharmacies()
  const { notification } = App.useApp()
  const [prompts, setPrompts] = useState<PromptVersion[] | null>(null)
  const [runs, setRuns] = useState<AiRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([api<PromptVersion[]>('/ai/prompts'), api<AiRun[]>('/ai/runs')])
      .then(([p, r]) => {
        if (cancelled) return
        setPrompts(p)
        setRuns(r)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load the AI settings.')
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const latest = prompts?.[0]
  const shown = prompts?.find((p) => p.version === (viewing ?? latest?.version))
  const editing = draft !== null
  const pharmacyName = useMemo(() => {
    const list = pharmacies.state.status === 'ready' ? pharmacies.state.pharmacies : []
    return (id: number) => list.find((p) => p.id === id)?.name ?? `Pharmacy ${id}`
  }, [pharmacies.state])

  const save = async () => {
    if (draft === null) return
    setSaving(true)
    try {
      const saved = await api<PromptVersion>('/ai/prompts', { method: 'POST', body: JSON.stringify({ body: draft }) })
      setDraft(null)
      setViewing(null)
      reload()
      notification.success({ title: `Saved as version ${saved.version}`, description: 'The next AI run uses it.' })
    } catch (err) {
      notification.error({
        title: 'Could not save the instructions',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const columns: TableProps<AiRun>['columns'] = [
    {
      title: 'When',
      dataIndex: 'createdAt',
      render: (at: string, r) => (
        <>
          {when(at)}
          <CellNote>{`by ${r.requestedBy}`}</CellNote>
        </>
      ),
    },
    { title: 'Pharmacy', dataIndex: 'pharmacyId', render: (id: number) => pharmacyName(id) },
    {
      title: 'Rows',
      key: 'rows',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tag>{r.rowsSent} sent</Tag>
          <Tag color="green">{r.rowsSuggested} suggested</Tag>
          {r.rowsUnplaced > 0 && <Tag color="gold">{r.rowsUnplaced} not placed</Tag>}
        </Space>
      ),
    },
    {
      title: 'Model · instructions',
      key: 'model',
      render: (_, r) => (
        <>
          {r.model}
          <CellNote>{`version ${r.promptVersion}`}</CellNote>
        </>
      ),
    },
    {
      title: 'Tokens',
      key: 'tokens',
      render: (_, r) => (
        <>
          {(r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens).toLocaleString()} in ·{' '}
          {r.outputTokens.toLocaleString()} out
          <CellNote>{r.cacheReadTokens ? `${r.cacheReadTokens.toLocaleString()} from cache` : null}</CellNote>
        </>
      ),
    },
    {
      title: 'Cost',
      dataIndex: 'costUsd',
      align: 'right',
      render: (cost: string | null) => (cost === null ? '—' : `$${Number(cost).toFixed(3)}`),
    },
    {
      title: 'Result',
      key: 'result',
      render: (_, r) =>
        r.error ? (
          <Typography.Text type="danger">{r.error}</Typography.Text>
        ) : (
          <Tag color="green">OK</Tag>
        ),
    },
  ]

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        AI suggestions
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Staff choose transactions and click Ask AI. Claude suggests a category for each; a person always confirms.
      </Typography.Paragraph>

      {status &&
        (status.enabled ? (
          <Alert
            type="success"
            showIcon
            icon={<RobotOutlined />}
            title={`AI is on · ${status.model} · instructions version ${status.promptVersion}`}
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            title="AI is off"
            description="Add ANTHROPIC_API_KEY to the backend .env file and restart the backend. The key stays on the server."
            style={{ marginBottom: 16 }}
          />
        ))}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Card
        title="Instructions"
        loading={prompts === null && !error}
        extra={
          editing ? (
            <Space>
              <Button onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                Save as version {(latest?.version ?? 0) + 1}
              </Button>
            </Space>
          ) : (
            <Space>
              <Select<number>
                size="small"
                prefix={<HistoryOutlined />}
                value={shown?.version}
                onChange={setViewing}
                options={(prompts ?? []).map((p) => ({
                  value: p.version,
                  label: `Version ${p.version}${p.version === latest?.version ? ' (current)' : ''}`,
                }))}
                style={{ width: 190 }}
              />
              <Button onClick={() => setDraft(shown?.body ?? '')} disabled={!shown}>
                {shown && shown.version !== latest?.version ? 'Edit from this version' : 'Edit'}
              </Button>
            </Space>
          )
        }
        style={{ marginBottom: 24 }}
      >
        {shown && !editing && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Version {shown.version} · {shown.createdBy} · {when(shown.createdAt)}. The chart of accounts (with each
            account's description) is added after these instructions automatically.
          </Typography.Paragraph>
        )}
        {editing ? (
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoSize={{ minRows: 12, maxRows: 30 }}
            maxLength={20000}
            showCount
          />
        ) : (
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{shown?.body}</Typography.Paragraph>
        )}
      </Card>

      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          AI runs
        </Typography.Title>
        <Typography.Text type="secondary">
          Total cost: $
          {(runs ?? []).reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0).toFixed(3)}
        </Typography.Text>
      </Flex>
      <Table<AiRun>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={runs ?? []}
        loading={runs === null && !error}
        pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
        scroll={{ x: 900 }}
        locale={{ emptyText: 'No AI runs yet.' }}
      />
    </>
  )
}
