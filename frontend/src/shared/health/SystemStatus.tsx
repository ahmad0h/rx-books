import { ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Skeleton, Tag } from 'antd'
import { useHealth } from './useHealth.ts'

export function SystemStatus() {
  const { state, refresh } = useHealth()

  const refreshButton = (
    <Button icon={<ReloadOutlined />} onClick={refresh} size="small">
      Check again
    </Button>
  )

  if (state.kind === 'loading') {
    return (
      <Card title="System status">
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    )
  }

  const backendTag =
    state.kind === 'reachable' ? <Tag color="success">Online</Tag> : <Tag color="error">Unreachable</Tag>

  const databaseTag =
    state.kind === 'reachable' ? (
      state.report.database === 'up' ? (
        <Tag color="success">Connected</Tag>
      ) : (
        <Tag color="error">Not connected</Tag>
      )
    ) : (
      <Tag>Unknown</Tag>
    )

  return (
    <Card title="System status" extra={refreshButton}>
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: 'backend', label: 'Backend', children: backendTag },
          { key: 'database', label: 'Database', children: databaseTag },
          {
            key: 'version',
            label: 'Backend version',
            children: state.kind === 'reachable' ? state.report.version : '—',
          },
          { key: 'checked', label: 'Last checked', children: state.checkedAt.toLocaleTimeString() },
          ...(state.kind === 'unreachable' ? [{ key: 'error', label: 'Error', children: state.error }] : []),
        ]}
      />
    </Card>
  )
}
