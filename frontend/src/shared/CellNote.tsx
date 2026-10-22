import { Typography } from 'antd'

/** Grey note under a table cell's main text: two lines, then "more". Renders nothing when empty. */
export function CellNote({ children }: { children: string | null }) {
  if (!children) return null
  return (
    <Typography.Paragraph
      type="secondary"
      ellipsis={{ rows: 2, expandable: 'collapsible', symbol: (expanded) => (expanded ? 'less' : 'more') }}
      style={{ margin: '2px 0 0', fontSize: 13, maxWidth: 560 }}
    >
      {children}
    </Typography.Paragraph>
  )
}
