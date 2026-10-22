import { CreditCardOutlined, EditOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { Alert, App, Button, Flex, Popconfirm, Space, Table, Tag, Typography, type TableProps } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import { CellNote } from '../../../shared/CellNote.tsx'
import { useCoa } from '../../coa/useCoa.ts'
import { AccountFormModal } from './AccountFormModal.tsx'
import { formatDay, KIND_LABELS, today, type PharmacyAccount } from './account.ts'
import { usePharmacyAccounts } from './usePharmacyAccounts.ts'

/** A pharmacy's own bank and card accounts. */
export function AccountsTab({ pharmacyId }: { pharmacyId: number }) {
  const { state, reload } = usePharmacyAccounts(pharmacyId)
  const coa = useCoa()
  const { notification } = App.useApp()
  const [busyId, setBusyId] = useState<number | null>(null)
  // undefined = dialog closed, null = adding, PharmacyAccount = editing
  const [editing, setEditing] = useState<PharmacyAccount | null | undefined>(undefined)

  const accounts = state.status === 'ready' ? state.accounts : []
  const coaAccounts = coa.state.status === 'ready' ? coa.state.accounts : []

  const onSaved = (saved: PharmacyAccount, wasNew: boolean) => {
    setEditing(undefined)
    reload()
    notification.success({ title: `${saved.name} ${wasNew ? 'added' : 'updated'}`, duration: 4 })
  }

  /** Close (today) or reopen, keeping every other field as it is. */
  const setClosed = async (account: PharmacyAccount, close: boolean) => {
    setBusyId(account.id)
    try {
      await api<PharmacyAccount>(`/pharmacies/${pharmacyId}/accounts/${account.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: account.name,
          kind: account.kind,
          bank: account.bank,
          lastFour: account.lastFour,
          coaCode: account.coaCode,
          openedOn: account.openedOn,
          closedOn: close ? today() : null,
          notes: account.notes,
        }),
      })
      reload()
      notification.success({ title: `${account.name} ${close ? 'closed' : 'reopened'}`, duration: 4 })
    } catch (err) {
      notification.error({
        title: close ? 'Could not close the account' : 'Could not reopen the account',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const columns: TableProps<PharmacyAccount>['columns'] = [
    {
      title: 'Account',
      dataIndex: 'name',
      render: (name: string, a) => (
        <>
          <Space size={4} wrap>
            <Typography.Text strong type={a.closedOn ? 'secondary' : undefined}>
              {name}
            </Typography.Text>
            {a.closedOn && <Tag>Closed {formatDay(a.closedOn)}</Tag>}
          </Space>
          <CellNote>{a.notes}</CellNote>
        </>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'kind',
      render: (kind: PharmacyAccount['kind']) => (
        <Tag color={kind === 'credit_card' ? 'purple' : 'blue'}>{KIND_LABELS[kind]}</Tag>
      ),
    },
    { title: 'Bank', dataIndex: 'bank' },
    {
      title: 'Number',
      dataIndex: 'lastFour',
      render: (lastFour: string) => <Typography.Text code>•••• {lastFour}</Typography.Text>,
    },
    { title: 'Books to', dataIndex: 'coaLabel' },
    {
      title: 'Opened',
      dataIndex: 'openedOn',
      render: (day: string | null) => (day ? formatDay(day) : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      fixed: 'right',
      render: (_, a) => (
        <Space size={8}>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(a)}>
            Edit
          </Button>
          {a.closedOn ? (
            <Button size="small" icon={<UndoOutlined />} loading={busyId === a.id} onClick={() => setClosed(a, false)}>
              Reopen
            </Button>
          ) : (
            <Popconfirm
              title={`Close ${a.name}?`}
              description="It gets today's closing date and takes no new uploads. Its history stays."
              okText="Close account"
              onConfirm={() => setClosed(a, true)}
            >
              <Button size="small" loading={busyId === a.id}>
                Close
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          Every bank and card account the pharmacy uses, taken from its statements.
        </Typography.Text>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setEditing(null)}
          disabled={coa.state.status !== 'ready'}
        >
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
        <Table<PharmacyAccount>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={accounts}
          loading={state.status === 'loading'}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <Flex vertical align="center" gap={4} style={{ padding: 16 }}>
                <CreditCardOutlined style={{ fontSize: 24 }} />
                No accounts yet. Add each checking, savings and card account from the pharmacy's statements.
              </Flex>
            ),
          }}
        />
      )}

      <AccountFormModal
        open={editing !== undefined}
        pharmacyId={pharmacyId}
        account={editing ?? null}
        accounts={accounts}
        coa={coaAccounts}
        onClose={() => setEditing(undefined)}
        onSaved={onSaved}
      />
    </>
  )
}
