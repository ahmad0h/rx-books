import { FileTextOutlined, InboxOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload as AntUpload,
  type TableProps,
} from 'antd'
import { useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import { CellNote } from '../../../shared/CellNote.tsx'
import { formatDay, type PharmacyAccount } from '../accounts/account.ts'
import { Amount } from './Amount.tsx'
import {
  formatMonth,
  MAX_FILE_BYTES,
  type RowStatus,
  type Upload,
  type UploadPreview,
} from './transaction.ts'

interface Props {
  open: boolean
  pharmacyId: number
  /** Open accounts only; closed ones take no uploads. */
  accounts: PharmacyAccount[]
  onClose: () => void
  onImported: (upload: Upload) => void
}

const STATUS_TAGS: Record<RowStatus, { color: string; label: string }> = {
  new: { color: 'green', label: 'New' },
  loaded: { color: 'default', label: 'Already loaded' },
  held: { color: 'gold', label: 'Held for review' },
}

type Row = UploadPreview['rows'][number]

/** Choose an account and a bank CSV, preview it, then import the new rows. */
export function UploadModal({ open, pharmacyId, accounts, onClose, onImported }: Props) {
  const [accountId, setAccountId] = useState<number | undefined>(accounts.length === 1 ? accounts[0].id : undefined)
  const [file, setFile] = useState<{ name: string; content: string } | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const reset = () => {
    setFile(null)
    setPreview(null)
    setErrors([])
  }

  const body = () => JSON.stringify({ accountId, fileName: file?.name, content: file?.content })

  const call = async <T,>(path: string, done: (result: T) => void) => {
    setBusy(true)
    setErrors([])
    try {
      done(await api<T>(path, { method: 'POST', body: body() }))
    } catch (err) {
      setErrors(err instanceof ApiError ? err.messages : ['Something went wrong. Please try again.'])
    } finally {
      setBusy(false)
    }
  }

  const runPreview = () => call<UploadPreview>(`/pharmacies/${pharmacyId}/uploads/preview`, setPreview)
  const runImport = () => call<Upload>(`/pharmacies/${pharmacyId}/uploads`, onImported)

  const columns: TableProps<Row>['columns'] = [
    { title: 'Line', dataIndex: 'line', width: 64 },
    { title: 'Date', dataIndex: 'date', width: 120, render: (d: string) => formatDay(d) },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (description: string, row) => (
        <>
          {description}
          <CellNote>{row.memo}</CellNote>
        </>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      align: 'right',
      render: (amount: string) => <Amount value={amount} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      filters: (Object.keys(STATUS_TAGS) as RowStatus[]).map((s) => ({ text: STATUS_TAGS[s].label, value: s })),
      onFilter: (value, row) => row.status === value,
      render: (status: RowStatus) => <Tag color={STATUS_TAGS[status].color}>{STATUS_TAGS[status].label}</Tag>,
    },
  ]

  const footer = preview
    ? [
        <Button key="back" onClick={() => setPreview(null)} disabled={busy}>
          Back
        </Button>,
        <Button key="import" type="primary" loading={busy} disabled={preview.summary.new === 0} onClick={runImport}>
          Import {preview.summary.new} transaction{preview.summary.new === 1 ? '' : 's'}
        </Button>,
      ]
    : [
        <Button key="cancel" onClick={onClose} disabled={busy}>
          Cancel
        </Button>,
        <Button key="preview" type="primary" loading={busy} disabled={!accountId || !file} onClick={runPreview}>
          Preview
        </Button>,
      ]

  return (
    <Modal
      title={preview ? `Preview · ${preview.fileName}` : 'Upload bank or card CSV'}
      open={open}
      onCancel={() => !busy && onClose()}
      footer={footer}
      width={preview ? 960 : 560}
      destroyOnHidden
      afterClose={reset}
    >
      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={errors.length === 1 ? errors[0] : 'The file could not be read'}
          description={
            errors.length > 1 && (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )
          }
        />
      )}

      {preview ? (
        <>
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            bordered
            style={{ marginBottom: 16 }}
            items={[
              { key: 'format', label: 'Format', children: preview.format.label },
              {
                key: 'account',
                label: 'Account',
                children: `${preview.account.name} •••• ${preview.account.lastFour}`,
              },
              {
                key: 'dates',
                label: 'Dates',
                children: `${formatDay(preview.summary.firstDate)} – ${formatDay(preview.summary.lastDate)}`,
              },
              {
                key: 'rows',
                label: 'Rows',
                children: (
                  <Space size={4} wrap>
                    <Tag color="green">{preview.summary.new} new</Tag>
                    <Tag>{preview.summary.loaded} already loaded</Tag>
                    {preview.summary.held > 0 && <Tag color="gold">{preview.summary.held} held</Tag>}
                  </Space>
                ),
              },
              { key: 'in', label: 'Money in', children: <Amount value={preview.summary.moneyIn} /> },
              { key: 'out', label: 'Money out', children: <Amount value={preview.summary.moneyOut} /> },
              {
                key: 'months',
                label: 'Months',
                children: preview.summary.months.map(formatMonth).join(', '),
              },
            ]}
          />
          {preview.warnings.map((w) => (
            <Alert key={w} type="warning" showIcon title={w} style={{ marginBottom: 8 }} />
          ))}
          <Table<Row>
            rowKey="line"
            size="small"
            columns={columns}
            dataSource={preview.rows}
            pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
            style={{ marginTop: 8 }}
          />
          <Typography.Text type="secondary">
            New rows are saved in 9999 · Uncategorized. Rules categorize them in the next step.
          </Typography.Text>
        </>
      ) : (
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="Account" required>
            <Select
              value={accountId}
              onChange={setAccountId}
              placeholder="Choose the bank or card account"
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.name} · ${a.bank} •••• ${a.lastFour}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="CSV file"
            required
            extra="Download it from the bank's website. US Bank checking / savings and Chase credit card files are supported."
          >
            <AntUpload.Dragger
              accept=".csv,text/csv"
              multiple={false}
              showUploadList={false}
              beforeUpload={(picked) => {
                setErrors([])
                if (picked.size > MAX_FILE_BYTES) {
                  setFile(null)
                  setErrors(['The file is too large (2 MB at most). Download one month at a time.'])
                } else {
                  void picked.text().then((content) => setFile({ name: picked.name, content }))
                }
                return false // read here; nothing is sent until Preview
              }}
            >
              {file ? (
                <Flex vertical align="center" gap={4}>
                  <FileTextOutlined style={{ fontSize: 28 }} />
                  <Typography.Text strong>{file.name}</Typography.Text>
                  <Typography.Text type="secondary">Click or drop to choose another file</Typography.Text>
                </Flex>
              ) : (
                <Flex vertical align="center" gap={4}>
                  <InboxOutlined style={{ fontSize: 28 }} />
                  <Typography.Text>Click or drop a CSV file here</Typography.Text>
                </Flex>
              )}
            </AntUpload.Dragger>
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

