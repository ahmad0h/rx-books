import { Alert, Form, Input, InputNumber, Modal, Select, Switch } from 'antd'
import { useMemo, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import { ACCOUNT_TYPES, TYPE_LABELS, UNCATEGORIZED_CODE, type CoaAccount } from '../coa/coa.ts'
import type { Rule, RuleInput } from './rule.ts'

interface Props {
  open: boolean
  /** The rule being edited, or null when adding a new one. */
  rule: Rule | null
  /** Where a new rule goes: null = shared. */
  pharmacyId: number | null
  /** Shown in the title, e.g. "shared" or the pharmacy name. */
  listName: string
  accounts: CoaAccount[]
  onClose: () => void
  onSaved: (saved: Rule, wasNew: boolean) => void
}

/** Transfers and balance-sheet accounts always need a person to confirm. */
const BALANCE_SHEET = new Set(['asset', 'liability', 'equity'])

export function RuleFormModal({ open, rule, pharmacyId, listName, accounts, onClose, onSaved }: Props) {
  const [form] = Form.useForm<RuleInput>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = rule === null
  const coaCode = Form.useWatch('coaCode', form)
  const balanceSheet = BALANCE_SHEET.has(accounts.find((a) => a.code === coaCode)?.type ?? '')

  // Accounts a transaction can go to, grouped by type. A rule's current account stays listed.
  const accountOptions = useMemo(
    () =>
      ACCOUNT_TYPES.map((type) => ({
        label: TYPE_LABELS[type],
        options: accounts
          .filter(
            (a) =>
              a.type === type &&
              a.code !== UNCATEGORIZED_CODE &&
              ((a.isActive && a.categorizable) || a.code === rule?.coaCode),
          )
          .map((a) => ({ value: a.code, label: a.label })),
      })).filter((group) => group.options.length > 0),
    [accounts, rule],
  )

  const onFinish = async (values: RuleInput) => {
    setError(null)
    setSaving(true)
    const body = {
      ...values,
      tag: values.tag ?? null,
      sourceNote: values.sourceNote ?? null,
      priority: values.priority ?? null,
    }
    try {
      const saved = await api<Rule>(isNew ? '/rules' : `/rules/${rule.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(isNew ? { ...body, pharmacyId } : body),
      })
      setSaving(false)
      onSaved(saved, isNew)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the rule. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? `Add rule · ${listName}` : `Edit rule · ${rule.keyword}`}
      open={open}
      onCancel={() => !saving && onClose()}
      onOk={() => form.submit()}
      okText={isNew ? 'Add rule' : 'Save changes'}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
      afterClose={() => setError(null)}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Form<RuleInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={onFinish}
        initialValues={
          rule
            ? {
                keyword: rule.keyword,
                coaCode: rule.coaCode,
                tag: rule.tag,
                priority: rule.priority,
                autoApprove: rule.autoApprove,
                sourceNote: rule.sourceNote,
              }
            : { autoApprove: true }
        }
      >
        <Form.Item
          label="Keyword"
          name="keyword"
          extra="Matches at the start of a word, in any case. Add DEPOSIT or WITHDRAWAL to tell money in from money out."
          rules={[
            { required: true, whitespace: true, message: 'Enter the keyword.' },
            { min: 3, message: 'The keyword must be at least 3 characters.' },
            { max: 120, message: 'The keyword is too long.' },
          ]}
        >
          <Input placeholder="e.g. MCKESSON" autoFocus style={{ textTransform: 'uppercase' }} />
        </Form.Item>

        <Form.Item label="Account" name="coaCode" rules={[{ required: true, message: 'Choose the account.' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Search accounts"
            options={accountOptions}
            onChange={(code: string) => {
              const type = accounts.find((a) => a.code === code)?.type ?? ''
              if (BALANCE_SHEET.has(type)) form.setFieldValue('autoApprove', false)
            }}
          />
        </Form.Item>

        <Form.Item
          label="Approve matches automatically"
          name="autoApprove"
          valuePropName="checked"
          extra={
            balanceSheet
              ? 'Transfers and balance-sheet accounts always need a person to confirm.'
              : 'When off, a match is only a suggestion that staff confirm.'
          }
          rules={[
            {
              validator: (_, value) =>
                value && balanceSheet
                  ? Promise.reject(new Error('Turn this off for transfers and balance-sheet accounts.'))
                  : Promise.resolve(),
            },
          ]}
        >
          <Switch disabled={balanceSheet} />
        </Form.Item>

        <Form.Item
          label="Priority"
          name="priority"
          extra={
            isNew
              ? 'Optional. Lower runs first. Leave empty to put it after the last rule.'
              : 'Lower runs first. Pharmacy rules always run before shared ones.'
          }
          rules={[{ type: 'integer', min: 1, max: 99999, message: 'Use a whole number from 1 to 99999.' }]}
        >
          <InputNumber min={1} max={99999} precision={0} placeholder="Auto" style={{ width: 140 }} />
        </Form.Item>

        <Form.Item
          label="Tag"
          name="tag"
          rules={[{ pattern: /^[A-Za-z0-9_-]{1,60}$/, message: 'Letters, numbers, - and _ only (no spaces).' }]}
        >
          <Input placeholder="e.g. RX_WHOLESALE" />
        </Form.Item>

        <Form.Item
          label="Note"
          name="sourceNote"
          extra="Why this rule exists, for whoever reads it next."
          rules={[{ max: 1000, message: 'The note is too long.' }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>

        {/* Lets Enter submit the form; the visible button is in the dialog footer. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  )
}
