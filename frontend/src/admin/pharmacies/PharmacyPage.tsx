import { ArrowLeftOutlined, EditOutlined, FilterOutlined } from '@ant-design/icons'
import { Alert, App, Button, Descriptions, Flex, Skeleton, Tabs, Typography } from 'antd'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { NotFoundPage } from '../../pages/NotFoundPage.tsx'
import { AccountsTab } from './accounts/AccountsTab.tsx'
import { PharmacyFormModal } from './PharmacyFormModal.tsx'
import { usePharmacy } from './usePharmacy.ts'

const TABS = ['accounts', 'details'] as const
type Tab = (typeof TABS)[number]

/** One pharmacy: its bank and card accounts, and its details. More tabs come with later phases. */
export function PharmacyPage() {
  const params = useParams()
  const id = Number(params.id)
  const [search, setSearch] = useSearchParams()
  const tab: Tab = TABS.find((t) => t === search.get('tab')) ?? 'accounts'
  const { state, reload } = usePharmacy(id)
  const { notification } = App.useApp()
  const [editing, setEditing] = useState(false)

  if (!Number.isInteger(id) || id < 1) return <NotFoundPage />

  const back = (
    <Link to="/admin/pharmacies">
      <ArrowLeftOutlined /> Pharmacies
    </Link>
  )

  if (state.status === 'loading') {
    return (
      <>
        {back}
        <Skeleton active style={{ marginTop: 16 }} />
      </>
    )
  }
  if (state.status === 'error') {
    return (
      <>
        {back}
        <Alert
          type="error"
          showIcon
          title={state.message}
          style={{ marginTop: 16 }}
          action={
            <Button size="small" onClick={reload}>
              Try again
            </Button>
          }
        />
      </>
    )
  }

  const { pharmacy } = state
  return (
    <>
      {back}
      <Flex justify="space-between" align="center" wrap gap={12} style={{ margin: '8px 0 8px' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {pharmacy.name}
        </Typography.Title>
        <Link to={`/admin/rules?list=${pharmacy.id}`}>
          <Button icon={<FilterOutlined />}>Rules</Button>
        </Link>
      </Flex>

      <Tabs
        activeKey={tab}
        onChange={(key) => setSearch(key === 'accounts' ? {} : { tab: key })}
        items={[
          { key: 'accounts', label: 'Bank & card accounts', children: <AccountsTab pharmacyId={pharmacy.id} /> },
          {
            key: 'details',
            label: 'Details',
            children: (
              <Descriptions
                bordered
                column={1}
                size="middle"
                style={{ maxWidth: 640 }}
                extra={
                  <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                }
                items={[
                  { key: 'name', label: 'Pharmacy', children: pharmacy.name },
                  { key: 'owner', label: 'Owner', children: pharmacy.ownerName },
                  { key: 'phone', label: 'Phone', children: pharmacy.ownerPhone },
                  { key: 'email', label: 'Email (sign-in)', children: pharmacy.ownerEmail },
                  { key: 'added', label: 'Added', children: new Date(pharmacy.createdAt).toLocaleDateString() },
                ]}
              />
            ),
          },
        ]}
      />

      <PharmacyFormModal
        open={editing}
        pharmacy={pharmacy}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false)
          reload()
          notification.success({ title: `${saved.name} updated`, duration: 4 })
        }}
      />
    </>
  )
}
