import { Alert, App, Form, Input, Modal } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../shared/api.ts'

/** Must match the backend rule (MIN_PASSWORD_LENGTH). */
const MIN_PASSWORD_LENGTH = 12

interface ChangePasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<ChangePasswordForm>()
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (saving) return
    onClose()
  }

  const onFinish = async ({ currentPassword, newPassword }: ChangePasswordForm) => {
    setError(null)
    setSaving(true)
    try {
      await api<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      void message.success('Your password has been changed. Other devices have been signed out.')
      setSaving(false)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Change password"
      open={open}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Change password"
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      afterClose={() => {
        form.resetFields()
        setError(null)
      }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Form<ChangePasswordForm> form={form} layout="vertical" requiredMark={false} onFinish={onFinish} disabled={saving}>
        <Form.Item
          label="Current password"
          name="currentPassword"
          rules={[{ required: true, message: 'Enter your current password.' }]}
        >
          <Input.Password autoComplete="current-password" autoFocus />
        </Form.Item>

        <Form.Item
          label="New password"
          name="newPassword"
          extra={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          rules={[
            { required: true, message: 'Enter a new password.' },
            { min: MIN_PASSWORD_LENGTH, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
            { max: 200, message: 'That password is too long.' },
            ({ getFieldValue }) => ({
              validator: (_, value: string | undefined) =>
                value && value === getFieldValue('currentPassword')
                  ? Promise.reject(new Error('Choose a password different from your current one.'))
                  : Promise.resolve(),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label="Confirm new password"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Type the new password again.' },
            ({ getFieldValue }) => ({
              validator: (_, value: string | undefined) =>
                !value || value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('The two passwords do not match.')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        {/* Lets Enter submit the form; the visible button is in the dialog footer. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  )
}
