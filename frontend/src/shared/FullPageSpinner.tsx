import { Flex, Spin } from 'antd'

export function FullPageSpinner() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
      <Spin size="large" />
    </Flex>
  )
}
