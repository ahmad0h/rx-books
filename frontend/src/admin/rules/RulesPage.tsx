import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Flex,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api, ApiError } from '../../shared/api.ts'
import { CellNote } from '../../shared/CellNote.tsx'
import { useCoa } from '../coa/useCoa.ts'
import { usePharmacies } from '../pharmacies/usePharmacies.ts'
import { RuleFormModal } from './RuleFormModal.tsx'
import { RuleTestBox } from './RuleTestBox.tsx'
import { SOURCE_LABELS, type Rule, type RuleList } from './rule.ts'
import { useRules } from './useRules.ts'

type StatusFilter = 'active' | 'retired' | 'all'

function matchesSearch(rule: Rule, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [rule.keyword, rule.account, rule.tag ?? '', rule.sourceNote ?? ''].some((value) =>
    value.toLowerCase().includes(q),
  )
}

/** ?list=shared (default) or ?list=<pharmacy id>, so the choice survives a reload. */
function listFrom(value: string | null): RuleList {
  return value && /^\d+$/.test(value) ? Number(value) : 'shared'
}

export function RulesPage() {
  const [params, setParams] = useSearchParams()
  const list = listFrom(params.get('list'))
  const pharmacyId = list === 'shared' ? null : list
  const { state, reload } = useRules(list)
  const coa = useCoa()
  const pharmacies = usePharmacies()
  const { notification } = App.useApp()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [busyId, setBusyId] = useState<number | null>(null)
  // undefined = dialog closed, null = adding, Rule = editing
  const [editing, setEditing] = useState<Rule | null | undefined>(undefined)

  const pharmacyList = pharmacies.state.status === 'ready' ? pharmacies.state.pharmacies : []
  const accounts = coa.state.status === 'ready' ? coa.state.accounts : []
  const listName =
    pharmacyId === null
      ? 'Shared rules'
      : (pharmacyList.find((p) => p.id === pharmacyId)?.name ?? `Pharmacy ${pharmacyId}`)

  const all = useMemo(() => (state.status === 'ready' ? state.rules : []), [state])
  const rules = useMemo(
    () =>
      all.filter(
        (r) => matchesSearch(r, search) && (status === 'all' || (r.retiredAt === null) === (status === 'active')),
      ),
    [all, search, status],
  )
  const activeCount = all.filter((r) => r.retiredAt === null).length

  const onSaved = (saved: Rule, wasNew: boolean) => {
    setEditing(undefined)
    reload()
    notification.success({ title: `Rule ${saved.keyword} ${wasNew ? 'added' : 'updated'}`, duration: 4 })
  }

  const setRetired = async (rule: Rule, retire: boolean) => {
    setBusyId(rule.id)
    try {
      await api<Rule>(retire ? `/rules/${rule.id}` : `/rules/${rule.id}/restore`, {
        method: retire ? 'DELETE' : 'POST',
      })
      reload()
      notification.success({ title: `Rule ${rule.keyword} ${retire ? 'deleted' : 'restored'}`, duration: 4 })
    } catch (err) {
      notification.error({
        title: retire ? 'Could not delete the rule' : 'Could not restore the rule',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const columns: TableProps<Rule>['columns'] = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 90,
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Keyword',
      dataIndex: 'keyword',
      // Wide enough for the longest keywords on one line; the note wraps under it.
      width: 300,
      sorter: (a, b) => a.keyword.localeCompare(b.keyword),
      render: (keyword: string, rule) => (
        <>
          <Space size={4} wrap>
            <Typography.Text
              code
              strong={rule.retiredAt === null}
              type={rule.retiredAt ? 'secondary' : undefined}
              style={{ whiteSpace: 'nowrap' }}
            >
              {keyword}
            </Typography.Text>
            {rule.retiredAt && <Tag>Deleted</Tag>}
          </Space>
          <CellNote>{rule.sourceNote}</CellNote>
        </>
      ),
    },
    {
      title: 'Account',
      dataIndex: 'account',
      sorter: (a, b) => a.coaCode.localeCompare(b.coaCode),
    },
    {
      title: 'Approval',
      dataIndex: 'autoApprove',
      filters: [
        { text: 'Automatic', value: true },
        { text: 'Staff confirm', value: false },
      ],
      onFilter: (value, rule) => rule.autoApprove === value,
      render: (auto: boolean) => (auto ? <Tag color="green">Automatic</Tag> : <Tag color="gold">Staff confirm</Tag>),
    },
    {
      title: 'Tag',
      dataIndex: 'tag',
      render: (tag: string | null) =>
        tag ? (
          <span style={{ whiteSpace: 'nowrap' }}>{tag}</span>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      render: (source: Rule['source'], rule) => (
        <Typography.Text type="secondary">
          {SOURCE_LABELS[source]} · {new Date(rule.createdAt).toLocaleDateString()}
        </Typography.Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      fixed: 'right',
      render: (_, rule) =>
        rule.retiredAt ? (
          <Button
            size="small"
            icon={<UndoOutlined />}
            loading={busyId === rule.id}
            onClick={() => setRetired(rule, false)}
          >
            Restore
          </Button>
        ) : (
          <Space size={8}>
            <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(rule)}>
              Edit
            </Button>
            <Popconfirm
              title={`Delete rule ${rule.keyword}?`}
              description="It stops matching right away. It stays in the history and can be restored."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => setRetired(rule, true)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={busyId === rule.id}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Rules
          </Typography.Title>
          <Typography.Text type="secondary">
            Keywords that categorize bank transactions. Pharmacy rules run first, then shared rules.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)} disabled={!accounts.length}>
          Add rule
        </Button>
      </Flex>

      <Flex align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Text strong>List</Typography.Text>
        <Select<RuleList>
          value={list}
          onChange={(value) => {
            setParams(value === 'shared' ? {} : { list: String(value) })
            setSearch('')
          }}
          loading={pharmacies.state.status === 'loading'}
          options={[
            { value: 'shared', label: 'Shared rules — every pharmacy' },
            ...(pharmacyList.length
              ? [
                  {
                    label: 'Pharmacy rules',
                    options: pharmacyList.map((p) => ({ value: p.id, label: p.name })),
                  },
                ]
              : []),
          ]}
          style={{ minWidth: 280 }}
        />
        {state.status === 'ready' && (
          <Typography.Text type="secondary">
            {activeCount} active rule{activeCount === 1 ? '' : 's'}
          </Typography.Text>
        )}
      </Flex>

      <RuleTestBox key={String(list)} pharmacyId={pharmacyId} listName={listName} />

      {state.status === 'error' ? (
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
      ) : (
        <>
          <Flex wrap gap={12} style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search keyword, account, tag or note"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'retired', label: 'Deleted' },
                { value: 'all', label: 'All' },
              ]}
            />
          </Flex>
          <Table<Rule>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={rules}
            loading={state.status === 'loading'}
            pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{
              emptyText:
                all.length === 0 ? `No rules for ${listName} yet. Add the first one.` : 'No rules match these filters.',
            }}
          />
        </>
      )}

      <RuleFormModal
        open={editing !== undefined}
        rule={editing ?? null}
        pharmacyId={pharmacyId}
        listName={listName}
        accounts={accounts}
        onClose={() => setEditing(undefined)}
        onSaved={onSaved}
      />
    </>
  )
}
