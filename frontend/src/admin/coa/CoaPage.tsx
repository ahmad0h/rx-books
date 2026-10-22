import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
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
import { api, ApiError } from '../../shared/api.ts'
import { CellNote } from '../../shared/CellNote.tsx'
import { CoaFormModal } from './CoaFormModal.tsx'
import {
  ACCOUNT_TYPES,
  TYPE_COLORS,
  TYPE_LABELS,
  UNCATEGORIZED_CODE,
  type AccountType,
  type CoaAccount,
} from './coa.ts'
import { useCoa } from './useCoa.ts'

type StatusFilter = 'active' | 'inactive' | 'all'

function matchesSearch(account: CoaAccount, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [account.code, account.name, account.ownerLabel ?? '', account.description ?? ''].some((value) =>
    value.toLowerCase().includes(q),
  )
}

export function CoaPage() {
  const { state, reload } = useCoa()
  const { notification } = App.useApp()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<AccountType | undefined>(undefined)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [busyCode, setBusyCode] = useState<string | null>(null)
  // undefined = dialog closed, null = adding, CoaAccount = editing
  const [editing, setEditing] = useState<CoaAccount | null | undefined>(undefined)

  const all = useMemo(() => (state.status === 'ready' ? state.accounts : []), [state])
  const accounts = useMemo(
    () =>
      all.filter(
        (a) =>
          matchesSearch(a, search) &&
          (!type || a.type === type) &&
          (status === 'all' || a.isActive === (status === 'active')),
      ),
    [all, search, type, status],
  )

  const onSaved = (saved: CoaAccount, wasNew: boolean) => {
    setEditing(undefined)
    reload()
    notification.success({
      title: `${saved.label} ${wasNew ? 'added' : 'updated'}`,
      duration: 4,
    })
  }

  const setActive = async (account: CoaAccount, isActive: boolean) => {
    setBusyCode(account.code)
    try {
      const saved = await api<CoaAccount>(`/coa/${account.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: account.name,
          type: account.type,
          expenseGroup: account.expenseGroup,
          description: account.description,
          ownerLabel: account.ownerLabel,
          categorizable: account.categorizable,
          contraOf: account.contraOf,
          isActive,
        }),
      })
      reload()
      notification.success({
        title: `${saved.label} ${isActive ? 'reactivated' : 'deactivated'}`,
        duration: 4,
      })
    } catch (err) {
      notification.error({
        title: 'Could not change the account',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusyCode(null)
    }
  }

  const columns: TableProps<CoaAccount>['columns'] = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 80,
      sorter: (a, b) => a.code.localeCompare(b.code),
      defaultSortOrder: 'ascend',
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Account',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, account) => (
        <>
          <Space size={4} wrap>
            <Typography.Text strong type={account.isActive ? undefined : 'secondary'}>
              {name}
            </Typography.Text>
            {!account.isActive && <Tag>Inactive</Tag>}
            {!account.categorizable && (
              <Tag title="Journal entries only — transactions cannot be put here">No transactions</Tag>
            )}
            {account.contraOf && <Tag title="Contra account">Offsets {account.contraOf}</Tag>}
          </Space>
          <CellNote>{account.description}</CellNote>
        </>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (t: AccountType, account) => (
        <Space size={4} wrap>
          <Tag color={TYPE_COLORS[t]}>{TYPE_LABELS[t]}</Tag>
          {account.expenseGroup && <Typography.Text type="secondary">{account.expenseGroup}</Typography.Text>}
        </Space>
      ),
    },
    {
      title: 'Owner sees',
      dataIndex: 'ownerLabel',
      render: (label: string | null) => label ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      fixed: 'right',
      render: (_, account) => (
        <Space size={8}>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(account)}>
            Edit
          </Button>
          {account.code !== UNCATEGORIZED_CODE &&
            (account.isActive ? (
              <Popconfirm
                title={`Deactivate ${account.label}?`}
                description="It stays in reports and history, but can no longer be chosen."
                okText="Deactivate"
                onConfirm={() => setActive(account, false)}
              >
                <Button size="small" danger loading={busyCode === account.code}>
                  Deactivate
                </Button>
              </Popconfirm>
            ) : (
              <Button size="small" loading={busyCode === account.code} onClick={() => setActive(account, true)}>
                Reactivate
              </Button>
            ))}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Chart of accounts
          </Typography.Title>
          <Typography.Text type="secondary">One list shared by every pharmacy.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
          Add account
        </Button>
      </Flex>

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
              placeholder="Search by code, name or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <Select<AccountType>
              allowClear
              placeholder="All types"
              value={type}
              onChange={setType}
              options={ACCOUNT_TYPES.map((t) => ({
                value: t,
                label: TYPE_LABELS[t],
              }))}
              style={{ width: 200 }}
            />
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All' },
              ]}
            />
          </Flex>
          <Table<CoaAccount>
            rowKey="code"
            size="middle"
            columns={columns}
            dataSource={accounts}
            loading={state.status === 'loading'}
            pagination={false}
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No accounts match these filters.' }}
            footer={() =>
              state.status === 'ready' && (
                <Typography.Text type="secondary">
                  Showing {accounts.length} of {all.length} accounts
                </Typography.Text>
              )
            }
          />
        </>
      )}

      <CoaFormModal
        open={editing !== undefined}
        account={editing ?? null}
        accounts={all}
        onClose={() => setEditing(undefined)}
        onSaved={onSaved}
      />
    </>
  )
}
