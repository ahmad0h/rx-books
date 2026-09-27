import { Button, Result } from 'antd'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="This page doesn't exist."
      extra={
        <Link to="/">
          <Button type="primary">Back to start</Button>
        </Link>
      }
    />
  )
}
