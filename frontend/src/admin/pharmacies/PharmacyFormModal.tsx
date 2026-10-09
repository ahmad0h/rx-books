import { Alert, Form, Input, Modal, Typography } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { Pharmacy, PharmacyInput } from './pharmacy.ts'

interface Props {
  open: boolean
  /** The pharmacy being edited, or null when adding a new one. */
  pharmacy: Pharmacy | null
  onClose: () => void
  onSaved: (saved: Pharmacy, wasNew: boolean) => void
}

/** Same rule as the backend: 7 to 15 digits, with optional + ( ) - . and spaces. */
const PHONE = /^(?=(?:\D*\d){7,15}\D*$)[0-9+().\-\s]+$/

export function PharmacyFormModal({ open, pharmacy, onClose, onSaved }: Props) {
  const [form] = Form.useForm<PharmacyInput>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = pharmacy === null

  const onFinish = async (values: PharmacyInput) => {
    setError(null)
    setSaving(true)
    try {
      const saved = await api<Pharmacy>(isNew ? '/pharmacies' : `/pharmacies/${pharmacy.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(values),
      })
      setSaving(false)
      onSaved(saved, isNew)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the pharmacy. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Add pharmacy' : 'Edit pharmacy'}
      open={open}
      onCancel={() => !saving && onClose()}
      onOk={() => form.submit()}
      okText={isNew ? 'Add pharmacy' : 'Save changes'}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      afterClose={() => setError(null)}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Form<PharmacyInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={onFinish}
        initialValues={
          pharmacy
            ? {
                name: pharmacy.name,
                ownerName: pharmacy.ownerName,
                ownerPhone: pharmacy.ownerPhone,
                ownerEmail: pharmacy.ownerEmail,
              }
            : undefined
        }
      >
        <Form.Item
          label="Pharmacy name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Enter the pharmacy name.' },
            { max: 160, message: 'The pharmacy name is too long.' },
          ]}
        >
          <Input placeholder="e.g. Lakeside Community Pharmacy" autoFocus />
        </Form.Item>

        <Typography.Text strong style={{ display: 'block', margin: '8px 0 12px' }}>
          Owner
        </Typography.Text>

        <Form.Item
          label="Owner name"
          name="ownerName"
          rules={[
            { required: true, whitespace: true, message: "Enter the owner's name." },
            { min: 2, message: "Enter the owner's name." },
            { max: 120, message: "The owner's name is too long." },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Form.Item
          label="Owner phone"
          name="ownerPhone"
          rules={[
            { required: true, whitespace: true, message: "Enter the owner's phone number." },
            { pattern: PHONE, message: 'Enter a valid phone number.' },
          ]}
        >
          <Input type="tel" placeholder="(612) 555-0142" autoComplete="off" />
        </Form.Item>

        <Form.Item
          label="Owner email"
          name="ownerEmail"
          extra={isNew ? 'The owner signs in to RxBooks with this email.' : 'Changing it also changes the owner’s sign-in email.'}
          rules={[
            { required: true, whitespace: true, message: 'Enter the owner’s email address.' },
            { type: 'email', message: 'Enter a valid email address.' },
          ]}
        >
          <Input type="email" autoComplete="off" />
        </Form.Item>

        {/* Lets Enter submit the form; the visible button is in the dialog footer. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  )
}
