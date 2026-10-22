import { SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, App, Button, Flex, Input, Select, Space, Table, Tag, Typography, type TableProps } from 'antd'
import { useMemo, useState } from 'react'
import { CellNote } from '../../../shared/CellNote.tsx'
import { formatDay, type PharmacyAccount } from '../accounts/account.ts'
import { usePharmacyAccounts } from '../accounts/usePharmacyAccounts.ts'
import { Amount } from './Amount.tsx'
import { formatMonth, type Transaction, type Upload } from './transaction.ts'
import { UploadModal } from './UploadModal.tsx'
import { useTransactions } from './useTransactions.ts'
import { useUploads } from './useUploads.ts'

interface Props {
  pharmacyId: number
  /** Switches to the accounts tab, for pharmacies with no accounts yet. */
  onAddAccounts: () => void
}

function matchesSearch(t: Transaction, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [t.description, t.memo ?? '', t.amount].some((v) => v.toLowerCase().includes(q))
}

/** A pharmacy's transactions by month, the CSV upload, and the upload history. */
export function TransactionsTab({ pharmacyId, onAddAccounts }: Props) {
  const accountsState = usePharmacyAccounts(pharmacyId).state
  const [accountId, setAccountId] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const { state, reload } = useTransactions(pharmacyId, { month, accountId })
  const uploads = useUploads(pharmacyId)
  const { notification } = App.useApp()
  // A new key each time the dialog opens, so it starts fresh.
  const [uploadKey, setUploadKey] = useState<number | null>(null)

  const accounts = useMemo(() => (accountsState.status === 'ready' ? accountsState.accounts : []), [accountsState])
  const openAccounts = accounts.filter((a) => !a.closedOn)
  const accountName = (id: number) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.name} •••• ${a.lastFour}` : `Account ${id}`
  }
  const data = state.status === 'ready' ? state.data : null
  const rows = useMemo(() => (data ? data.transactions.filter((t) => matchesSearch(t, search)) : []), [data, search])

  const onImported = (upload: Upload) => {
    setUploadKey(null)
    setAccountId(undefined)
    setMonth(upload.months[0])
    reload()
    uploads.reload()
    notification.success({
      title: `Imported ${upload.rowsAdded} transaction${upload.rowsAdded === 1 ? '' : 's'}`,
      description:
        `${accountName(upload.accountId)} · ${upload.months.map(formatMonth).join(', ')}` +
        (upload.rowsSkipped ? ` · ${upload.rowsSkipped} already loaded` : '') +
        (upload.rowsHeld ? ` · ${upload.rowsHeld} held for review` : ''),
      duration: 6,
    })
  }

  if (accountsState.status === 'ready' && accounts.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        title="Add the pharmacy's bank and card accounts first"
        description="Every uploaded file belongs to one of the pharmacy's accounts."
        action={
          <Button size="small" type="primary" onClick={onAddAccounts}>
            Add accounts
          </Button>
        }
      />
    )
  }

  const columns: TableProps<Transaction>['columns'] = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 120,
      render: (d: string) => <span style={{ whiteSpace: 'nowrap' }}>{formatDay(d)}</span>,
    },
    ...(accountId
      ? []
      : [
          {
            title: 'Account',
            dataIndex: 'accountId',
            render: (id: number) => <Typography.Text type="secondary">{accountName(id)}</Typography.Text>,
          },
        ]),
    {
      title: 'Description',
      dataIndex: 'description',
      render: (description: string, t) => (
        <>
          {description}
          <CellNote>{t.memo}</CellNote>
        </>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      align: 'right',
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (amount: string) => <Amount value={amount} />,
    },
    {
      title: 'Category',
      dataIndex: 'coaLabel',
      render: (label: string, t) => (t.coaCode === '9999' ? <Tag>Uncategorized</Tag> : label),
    },
  ]

  const uploadColumns: TableProps<Upload>['columns'] = [
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      render: (at: string, u) => (
        <>
          {new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          <CellNote>{`by ${u.uploadedBy}`}</CellNote>
        </>
      ),
    },
    { title: 'File', dataIndex: 'fileName' },
    { title: 'Account', dataIndex: 'accountId', render: (id: number) => accountName(id) },
    { title: 'Months', dataIndex: 'months', render: (m: string[]) => m.map(formatMonth).join(', ') },
    {
      title: 'Rows',
      key: 'rows',
      render: (_, u) => (
        <Space size={4} wrap>
          <Tag color="green">{u.rowsAdded} added</Tag>
          {u.rowsSkipped > 0 && <Tag>{u.rowsSkipped} already loaded</Tag>}
          {u.rowsHeld > 0 && <Tag color="gold">{u.rowsHeld} held</Tag>}
        </Space>
      ),
    },
  ]

  const summary = data?.month ? (
    <Space size={16} wrap>
      <Typography.Text strong>
        {formatMonth(data.month)} · {data.totals.count} transaction{data.totals.count === 1 ? '' : 's'}
      </Typography.Text>
      <span>
        In <Amount value={data.totals.moneyIn} />
      </span>
      <span>
        Out <Amount value={data.totals.moneyOut} />
      </span>
    </Space>
  ) : null

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex wrap gap={12}>
          <Select<number | 'all'>
            value={accountId ?? 'all'}
            onChange={(v) => {
              setAccountId(v === 'all' ? undefined : v)
              setMonth(undefined)
            }}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a: PharmacyAccount) => ({ value: a.id, label: accountName(a.id) })),
            ]}
            style={{ minWidth: 240 }}
          />
          <Select<string>
            value={data?.month ?? undefined}
            onChange={setMonth}
            placeholder="No months yet"
            disabled={!data?.months.length}
            options={(data?.months ?? []).map((m) => ({ value: m, label: formatMonth(m) }))}
            style={{ width: 140 }}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search description or amount"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
        </Flex>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadKey(Date.now())}
          disabled={openAccounts.length === 0}
        >
          Upload CSV
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
        <Table<Transaction>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={state.status === 'loading'}
          pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 760 }}
          locale={{
            emptyText: data?.months.length
              ? 'No transactions match your search.'
              : 'No transactions yet. Upload a bank or card CSV to start.',
          }}
          title={summary ? () => summary : undefined}
        />
      )}

      <Typography.Title level={5} style={{ marginTop: 32 }}>
        Upload history
      </Typography.Title>
      {uploads.state.status === 'error' ? (
        <Alert type="error" showIcon title={uploads.state.message} />
      ) : (
        <Table<Upload>
          rowKey="id"
          size="small"
          columns={uploadColumns}
          dataSource={uploads.state.status === 'ready' ? uploads.state.uploads : []}
          loading={uploads.state.status === 'loading'}
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 760 }}
          locale={{ emptyText: 'No uploads yet.' }}
        />
      )}

      {uploadKey !== null && (
        <UploadModal
          key={uploadKey}
          open
          pharmacyId={pharmacyId}
          accounts={openAccounts}
          onClose={() => setUploadKey(null)}
          onImported={onImported}
        />
      )}
    </>
  )
}
