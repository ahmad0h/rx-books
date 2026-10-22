import { Alert, AutoComplete, Form, Input, Modal, Segmented, Select } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api, ApiError } from '../../../shared/api.ts'
import type { CoaAccount } from '../../coa/coa.ts'
import {
  COMMON_BANKS,
  KIND_LABELS,
  codeFitsKind,
  type AccountKind,
  type PharmacyAccount,
  type PharmacyAccountInput,
} from './account.ts'

interface Props {
  open: boolean
  pharmacyId: number
  /** The account being edited, or null when adding a new one. */
  account: PharmacyAccount | null
  /** The pharmacy's other accounts, to show which codes are taken. */
  accounts: PharmacyAccount[]
  coa: CoaAccount[]
  onClose: () => void
  onSaved: (saved: PharmacyAccount, wasNew: boolean) => void
}

type FormValues = Omit<PharmacyAccountInput, 'openedOn' | 'closedOn' | 'notes'> & {
  openedOn?: string
  closedOn?: string
  notes?: string
}

export function AccountFormModal({ open, pharmacyId, account, accounts, coa, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = account === null
  const kind = Form.useWatch('kind', form) ?? account?.kind ?? 'checking'

  /** Codes this kind of account can use, with the ones already taken disabled. */
  const codeOptions = useMemo(() => {
    const takenBy = new Map(accounts.filter((a) => a.id !== account?.id).map((a) => [a.coaCode, a.name]))
    return coa
      .filter((c) => codeFitsKind(kind, c) && (c.isActive || c.code === account?.coaCode))
      .map((c) => ({
        value: c.code,
        label: takenBy.has(c.code) ? `${c.label} — used by ${takenBy.get(c.code)}` : c.label,
        disabled: takenBy.has(c.code),
      }))
  }, [coa, accounts, account, kind])
  /** The first free code, preferring one named for the type ("checking", "savings"). */
  const freeCode = (k: AccountKind) => {
    const taken = new Set(accounts.filter((a) => a.id !== account?.id).map((a) => a.coaCode))
    const free = coa.filter((c) => codeFitsKind(k, c) && c.isActive && !taken.has(c.code))
    const word = k === 'credit_card' ? 'card' : k
    return (free.find((c) => c.name.toLowerCase().includes(word)) ?? free[0])?.code
  }
  const noFreeCode = codeOptions.every((o) => o.disabled)

  const onFinish = async (values: FormValues) => {
    setError(null)
    setSaving(true)
    const body: PharmacyAccountInput = {
      ...values,
      openedOn: values.openedOn || null,
      closedOn: values.closedOn || null,
      notes: values.notes ?? null,
    }
    try {
      const saved = await api<PharmacyAccount>(
        isNew ? `/pharmacies/${pharmacyId}/accounts` : `/pharmacies/${pharmacyId}/accounts/${account.id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(body) },
      )
      setSaving(false)
      onSaved(saved, isNew)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the account. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Add bank or card account' : `Edit ${account.name}`}
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
                name: account.name,
                kind: account.kind,
                bank: account.bank,
                lastFour: account.lastFour,
                coaCode: account.coaCode,
                openedOn: account.openedOn ?? '',
                closedOn: account.closedOn ?? '',
                notes: account.notes ?? '',
              }
            : { kind: 'checking', coaCode: freeCode('checking') }
        }
      >
        <Form.Item label="Type" name="kind">
          <Segmented<AccountKind>
            options={(Object.keys(KIND_LABELS) as AccountKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            onChange={(k) => {
              // Pick a code that fits the new type, unless the current one already does.
              const current = coa.find((c) => c.code === form.getFieldValue('coaCode'))
              if (!current || !codeFitsKind(k, current)) form.setFieldValue('coaCode', freeCode(k))
            }}
          />
        </Form.Item>

        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Enter a name for the account.' },
            { min: 2, message: 'Enter a name for the account.' },
            { max: 120, message: 'The name is too long.' },
          ]}
        >
          <Input placeholder="e.g. Main operating checking" autoFocus />
        </Form.Item>

        <Form.Item
          label="Bank"
          name="bank"
          extra="As it appears on the statement."
          rules={[
            { required: true, whitespace: true, message: 'Enter the bank.' },
            { max: 80, message: 'The bank name is too long.' },
          ]}
        >
          <AutoComplete
            options={COMMON_BANKS.map((b) => ({ value: b }))}
            placeholder="e.g. US Bank"
            showSearch={{
              filterOption: (input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase()),
            }}
          />
        </Form.Item>

        <Form.Item
          label="Last 4 digits"
          name="lastFour"
          extra="Only the last 4 digits are stored, never the full number."
          rules={[
            { required: true, message: 'Enter the last 4 digits of the account number.' },
            { pattern: /^\d{4}$/, message: 'Enter exactly 4 digits.' },
          ]}
        >
          <Input maxLength={4} inputMode="numeric" placeholder="4821" style={{ width: 120 }} />
        </Form.Item>

        <Form.Item
          label="Chart-of-accounts code"
          name="coaCode"
          extra={
            noFreeCode ? (
              <>
                Every {kind === 'credit_card' ? 'card' : 'cash'} code is in use. Add the next one in the{' '}
                <Link to="/admin/chart-of-accounts">chart of accounts</Link> first.
              </>
            ) : (
              'Where this account’s transactions are booked. Each code is used once per pharmacy.'
            )
          }
          rules={[{ required: true, message: 'Choose the chart-of-accounts code.' }]}
        >
          <Select options={codeOptions} placeholder="Choose a code" />
        </Form.Item>

        <Form.Item label="Opened on" name="openedOn" style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}>
          <Input type="date" />
        </Form.Item>
        <Form.Item
          label="Closed on"
          name="closedOn"
          dependencies={['openedOn']}
          style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
          rules={[
            ({ getFieldValue }) => ({
              validator: (_, value?: string) => {
                const opened = getFieldValue('openedOn') as string | undefined
                return value && opened && value < opened
                  ? Promise.reject(new Error('Must be after the opening date.'))
                  : Promise.resolve()
              },
            }),
          ]}
        >
          <Input type="date" />
        </Form.Item>

        <Form.Item label="Notes" name="notes" rules={[{ max: 1000, message: 'The notes are too long.' }]}>
          <Input.TextArea rows={2} placeholder="e.g. Card reissued in March 2025; old number ended 1234." />
        </Form.Item>

        {/* Lets Enter submit the form; the visible button is in the dialog footer. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  )
}
