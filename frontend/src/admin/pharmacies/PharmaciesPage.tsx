import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, App, Button, Flex, Input, Table, Typography, type TableProps } from 'antd'
import { useMemo, useState } from 'react'
import { PharmacyFormModal } from './PharmacyFormModal.tsx'
import { TEMPORARY_OWNER_PASSWORD, type Pharmacy } from './pharmacy.ts'
import { usePharmacies } from './usePharmacies.ts'

function matchesSearch(pharmacy: Pharmacy, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [pharmacy.name, pharmacy.ownerName, pharmacy.ownerEmail, pharmacy.ownerPhone].some((value) =>
    value.toLowerCase().includes(q),
  )
}

export function PharmaciesPage() {
  const { state, reload } = usePharmacies()
  const { notification } = App.useApp()
  const [search, setSearch] = useState('')
  // undefined = dialog closed, null = adding, Pharmacy = editing
  const [editing, setEditing] = useState<Pharmacy | null | undefined>(undefined)

  const pharmacies = useMemo(
    () => (state.status === 'ready' ? state.pharmacies.filter((p) => matchesSearch(p, search)) : []),
    [state, search],
  )

  const onSaved = (saved: Pharmacy, wasNew: boolean) => {
    setEditing(undefined)
    reload()
    if (wasNew) {
      notification.success({
        title: `${saved.name} added`,
        description: (
          <>
            The owner can sign in now with <b>{saved.ownerEmail}</b> and the temporary password{' '}
            <b>{TEMPORARY_OWNER_PASSWORD}</b>.
          </>
        ),
        duration: 10,
      })
    } else {
      notification.success({ title: `${saved.name} updated`, duration: 4 })
    }
  }

  const columns: TableProps<Pharmacy>['columns'] = [
    {
      title: 'Pharmacy',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    { title: 'Owner', dataIndex: 'ownerName', sorter: (a, b) => a.ownerName.localeCompare(b.ownerName) },
    { title: 'Phone', dataIndex: 'ownerPhone' },
    { title: 'Email', dataIndex: 'ownerEmail' },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (createdAt: string) => new Date(createdAt).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, pharmacy) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(pharmacy)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Pharmacies
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
          Add pharmacy
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
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by pharmacy, owner, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360, marginBottom: 16 }}
          />
          <Table<Pharmacy>
            rowKey="id"
            columns={columns}
            dataSource={pharmacies}
            loading={state.status === 'loading'}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: search ? 'No pharmacies match your search.' : 'No pharmacies yet. Add the first one.',
            }}
          />
        </>
      )}

      <PharmacyFormModal
        open={editing !== undefined}
        pharmacy={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={onSaved}
      />
    </>
  )
}
