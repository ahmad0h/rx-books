import { Alert, Form, Input, Modal, Select, Switch } from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import {
  ACCOUNT_TYPES,
  EXPENSE_GROUPS,
  TYPE_LABELS,
  UNCATEGORIZED_CODE,
  type CoaAccount,
  type CoaInput,
} from './coa.ts'

interface Props {
  open: boolean
  /** The account being edited, or null when adding a new one. */
  account: CoaAccount | null
  /** Every account, for the "offsets" picker. */
  accounts: CoaAccount[]
  onClose: () => void
  onSaved: (saved: CoaAccount, wasNew: boolean) => void
}

type FormValues = Omit<CoaInput, 'expenseGroup' | 'contraOf'> & {
  expenseGroup?: CoaInput['expenseGroup']
  contraOf?: string | null
}

export function CoaFormModal({ open, account, accounts, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = account === null
  const type = Form.useWatch('type', form)
  const locked = account?.code === UNCATEGORIZED_CODE

  const onFinish = async ({ code, ...values }: FormValues) => {
    setError(null)
    setSaving(true)
    const fields = {
      ...values,
      expenseGroup: values.type === 'expense' ? (values.expenseGroup ?? null) : null,
      contraOf: values.contraOf ?? null,
    }
    try {
      const saved = await api<CoaAccount>(isNew ? '/coa' : `/coa/${account.code}`, {
        method: isNew ? 'POST' : 'PUT',
        // The code never changes after an account is created.
        body: JSON.stringify(isNew ? { code, ...fields } : { ...fields, isActive: account.isActive }),
      })
      setSaving(false)
      onSaved(saved, isNew)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the account. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Add account' : `Edit ${account.label}`}
      open={open}
      onCancel={() => !saving && onClose()}
      onOk={() => form.submit()}
      okText={isNew ? 'Add account' : 'Save changes'}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      afterClose={() => setError(null)}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={onFinish}
        initialValues={
          account
            ? {
                code: account.code,
                name: account.name,
                type: account.type,
                expenseGroup: account.expenseGroup,
                description: account.description,
                ownerLabel: account.ownerLabel,
                categorizable: account.categorizable,
                contraOf: account.contraOf,
              }
            : { categorizable: true }
        }
      >
        <Form.Item
          label="Code"
          name="code"
          extra={isNew ? '4 digits. It cannot be changed later.' : 'Codes cannot be changed.'}
          rules={[
            { required: true, message: 'Enter the 4-digit code.' },
            {
              pattern: /^\d{4}$/,
              message: 'The code must be exactly 4 digits.',
            },
          ]}
        >
          <Input placeholder="e.g. 6115" maxLength={4} disabled={!isNew} autoFocus={isNew} style={{ width: 120 }} />
        </Form.Item>

        <Form.Item
          label="Account name"
          name="name"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Enter the account name.',
            },
            { min: 2, message: 'Enter the account name.' },
            { max: 120, message: 'The account name is too long.' },
          ]}
        >
          <Input placeholder="e.g. Storage rent" autoFocus={!isNew} />
        </Form.Item>

        <Form.Item label="Type" name="type" rules={[{ required: true, message: 'Choose the account type.' }]}>
          <Select
            disabled={locked}
            options={ACCOUNT_TYPES.map((t) => ({
              value: t,
              label: TYPE_LABELS[t],
            }))}
            placeholder="Choose a type"
          />
        </Form.Item>

        {type === 'expense' && (
          <Form.Item
            label="Expense group"
            name="expenseGroup"
            rules={[{ required: true, message: 'Choose the expense group.' }]}
          >
            <Select options={EXPENSE_GROUPS.map((g) => ({ value: g, label: g }))} placeholder="Choose a group" />
          </Form.Item>
        )}

        <Form.Item
          label="Owner-facing name"
          name="ownerLabel"
          extra="The plain-language name pharmacy owners see when they answer questions."
          rules={[{ max: 120, message: 'The owner-facing name is too long.' }]}
        >
          <Input placeholder="e.g. Rent" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          extra="What belongs here. Helps staff (and later the AI) pick the right account."
          rules={[{ max: 1000, message: 'The description is too long.' }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item
          label="Offsets account"
          name="contraOf"
          extra="Only for contra accounts, e.g. accumulated depreciation offsets fixed assets."
        >
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="None"
            options={accounts.filter((a) => a.code !== account?.code).map((a) => ({ value: a.code, label: a.label }))}
          />
        </Form.Item>

        <Form.Item
          label="Transactions can go here"
          name="categorizable"
          valuePropName="checked"
          extra={
            locked
              ? 'Uncategorized must stay open: every new transaction starts here.'
              : 'Turn off for accounts that only receive journal entries (e.g. depreciation).'
          }
        >
          <Switch disabled={locked} />
        </Form.Item>

        {/* Lets Enter submit the form; the visible button is in the dialog footer. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  )
}
