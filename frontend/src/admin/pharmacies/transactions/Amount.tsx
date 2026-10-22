import { Typography } from 'antd'
import { formatMoney } from './transaction.ts'

/** Money in green, money out in red. */
export function Amount({ value }: { value: string }) {
  const n = Number(value)
  return (
    <Typography.Text type={n < 0 ? 'danger' : n > 0 ? 'success' : undefined} style={{ whiteSpace: 'nowrap' }}>
      {formatMoney(value)}
    </Typography.Text>
  )
}
