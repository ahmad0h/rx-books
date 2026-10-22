import {
  CheckOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Flex,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableProps,
} from 'antd'
import { useMemo, useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import { CellNote } from '../../../shared/CellNote.tsx'
import { ACCOUNT_TYPES, TYPE_LABELS, UNCATEGORIZED_CODE } from '../../coa/coa.ts'
import { useCoa } from '../../coa/useCoa.ts'
import { RuleFormModal } from '../../rules/RuleFormModal.tsx'
import type { RuleInput } from '../../rules/rule.ts'
import { formatDay } from '../accounts/account.ts'
import { usePharmacyAccounts } from '../accounts/usePharmacyAccounts.ts'
import { Amount } from './Amount.tsx'
import { AskOwnerModal } from './AskOwnerModal.tsx'
import {
  canAskAi,
  canAskOwner,
  estimateAiCost,
  formatMonth,
  LOW_CONFIDENCE,
  reasonFor,
  suggestKeyword,
  type AskAiResult,
  type AskOwnerResult,
  type CategorizeResult,
  type ImportResult,
  type Transaction,
  type TransactionStatus,
  type Upload,
} from './transaction.ts'
import { UploadModal } from './UploadModal.tsx'
import { useAiStatus } from './useAiStatus.ts'
import { useTransactions } from './useTransactions.ts'
import { useUploads } from './useUploads.ts'

interface Props {
  pharmacyId: number
  pharmacyName: string
  /** Switches to the accounts tab, for pharmacies with no accounts yet. */
  onAddAccounts: () => void
}

type View = 'review' | 'approved' | 'all'

const STATUS_TAGS: Record<TransactionStatus, { color: string; label: string }> = {
  approved: { color: 'green', label: 'Approved' },
  suggested: { color: 'gold', label: 'To confirm' },
  uncategorized: { color: 'default', label: 'Uncategorized' },
}

function matchesSearch(t: Transaction, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [t.description, t.memo ?? '', t.amount, t.coaLabel].some((v) => v.toLowerCase().includes(q))
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** A pharmacy's transactions by month: upload, review and approve their accounts. */
export function TransactionsTab({ pharmacyId, pharmacyName, onAddAccounts }: Props) {
  const accountsState = usePharmacyAccounts(pharmacyId).state
  const coa = useCoa()
  const [accountId, setAccountId] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<string | undefined>(undefined)
  const [view, setView] = useState<View>('review')
  const [search, setSearch] = useState('')
  const { state, reload } = useTransactions(pharmacyId, { month, accountId })
  const uploads = useUploads(pharmacyId)
  const { notification, modal } = App.useApp()
  const ai = useAiStatus()
  // A new key each time the upload dialog opens, so it starts fresh.
  const [uploadKey, setUploadKey] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | 'bulk' | 'run' | 'ai' | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  // Set when a person categorized a row and accepted the offer to make a rule.
  const [ruleDefaults, setRuleDefaults] = useState<Partial<RuleInput> | null>(null)
  // Rows in the "Ask owner" dialog, while it is open.
  const [askingOwner, setAskingOwner] = useState<Transaction[] | null>(null)

  const accounts = useMemo(() => (accountsState.status === 'ready' ? accountsState.accounts : []), [accountsState])
  const coaAccounts = useMemo(() => (coa.state.status === 'ready' ? coa.state.accounts : []), [coa.state])
  const openAccounts = accounts.filter((a) => !a.closedOn)
  const accountName = (id: number) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.name} •••• ${a.lastFour}` : `Account ${id}`
  }
  const data = state.status === 'ready' ? state.data : null
  const rows = useMemo(
    () =>
      data
        ? data.transactions.filter(
            (t) =>
              matchesSearch(t, search) &&
              (view === 'all' || (view === 'approved' ? t.status === 'approved' : t.status !== 'approved')),
          )
        : [],
    [data, search, view],
  )

  /** Accounts a person can pick for a transaction, grouped by type. */
  const accountOptions = useMemo(
    () =>
      ACCOUNT_TYPES.map((type) => ({
        label: TYPE_LABELS[type],
        options: coaAccounts
          .filter((a) => a.type === type && a.isActive && a.categorizable && a.code !== UNCATEGORIZED_CODE)
          .map((a) => ({ value: a.code, label: a.label })),
      })).filter((g) => g.options.length > 0),
    [coaAccounts],
  )

  const fail = (title: string, err: unknown) =>
    notification.error({ title, description: err instanceof ApiError ? err.message : 'Please try again.' })

  const refresh = () => {
    setSelected([])
    reload()
  }

  const onImported = (result: ImportResult) => {
    setUploadKey(null)
    setAccountId(undefined)
    setMonth(result.months[0])
    setView('review')
    refresh()
    uploads.reload()
    const c = result.categorization
    notification.success({
      title: `Imported ${plural(result.rowsAdded, 'transaction')}`,
      description:
        `${accountName(result.accountId)} · ${result.months.map(formatMonth).join(', ')}. ` +
        `Rules approved ${c.approved}, ${c.suggested} to confirm, ${c.uncategorized} uncategorized.` +
        (result.rowsSkipped ? ` ${result.rowsSkipped} already loaded.` : '') +
        (result.rowsHeld ? ` ${result.rowsHeld} held for review.` : ''),
      duration: 8,
    })
  }

  /** After a person (or the owner) decided a row: offer a rule so it's automatic next time. */
  const offerRule = (t: Transaction, coaCode: string, title: string, why?: string) => {
    const key = `rule-${t.id}`
    const keyword = suggestKeyword(t.description)
    notification.success({
      key,
      title,
      description: `Want "${keyword}" to go there automatically next time?`,
      actions: (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            notification.destroy(key)
            setRuleDefaults({
              keyword,
              coaCode,
              sourceNote: why ?? `Created from the ${formatDay(t.date)} transaction "${t.description}".`,
            })
          }}
        >
          Create a rule
        </Button>
      ),
      duration: 10,
    })
  }

  /** Uses the owner's answer: the row gets that category and is approved. */
  const acceptAnswer = async (t: Transaction) => {
    const q = t.question
    if (!q?.answerCode) return
    setBusy(t.id)
    try {
      await api(`/pharmacies/${pharmacyId}/questions/${q.id}/accept`, { method: 'POST' })
      refresh()
      offerRule(
        t,
        q.answerCode,
        "Owner's answer accepted",
        `Owner confirmed on ${formatDay((q.answeredAt ?? q.askedAt).slice(0, 10))} for "${t.description}"${q.answerNote ? `: ${q.answerNote}` : ''}.`,
      )
    } catch (err) {
      fail("Could not accept the owner's answer", err)
    } finally {
      setBusy(null)
    }
  }

  const cancelQuestion = async (t: Transaction) => {
    if (!t.question) return
    setBusy(t.id)
    try {
      await api(`/pharmacies/${pharmacyId}/questions/${t.question.id}/cancel`, { method: 'POST' })
      refresh()
    } catch (err) {
      fail('Could not cancel the question', err)
    } finally {
      setBusy(null)
    }
  }

  const onAskedOwner = (result: AskOwnerResult) => {
    setAskingOwner(null)
    refresh()
    notification.success({
      title: `Asked the owner about ${plural(result.asked, 'transaction')}`,
      description:
        'They see the questions when they sign in to RxBooks. Email reminders come later, so let them know for now.' +
        (result.overSoftCap.length
          ? ` Note: more than 5 open questions in ${result.overSoftCap.map(formatMonth).join(', ')}.`
          : ''),
      duration: 8,
    })
  }

  /** A person picks the account: approved as their decision, then offer a rule. */
  const setAccount = async (t: Transaction, coaCode: string) => {
    setBusy(t.id)
    try {
      await api(`/pharmacies/${pharmacyId}/transactions/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify({ coaCode }),
      })
      refresh()
      if (coaCode !== UNCATEGORIZED_CODE) offerRule(t, coaCode, 'Category saved')
    } catch (err) {
      fail('Could not change the category', err)
    } finally {
      setBusy(null)
    }
  }

  const approve = async (ids: number[], undo = false) => {
    setBusy(ids.length === 1 ? ids[0] : 'bulk')
    try {
      const res = await api<{ approved?: number; skipped?: number; unapproved?: number }>(
        `/pharmacies/${pharmacyId}/transactions/${undo ? 'unapprove' : 'approve'}`,
        { method: 'POST', body: JSON.stringify({ ids }) },
      )
      refresh()
      if (ids.length > 1) {
        notification.success({
          title: `Approved ${plural(res.approved ?? 0, 'transaction')}`,
          description: res.skipped ? `${res.skipped} skipped (already approved or still uncategorized).` : undefined,
          duration: 4,
        })
      }
    } catch (err) {
      fail(undo ? 'Could not undo the approval' : 'Could not approve', err)
    } finally {
      setBusy(null)
    }
  }

  const runRules = async (title?: string) => {
    if (!data?.month) return
    setBusy('run')
    try {
      const r = await api<CategorizeResult>(`/pharmacies/${pharmacyId}/transactions/categorize`, {
        method: 'POST',
        body: JSON.stringify({ month: data.month, accountId }),
      })
      refresh()
      notification.success({
        title: title ?? `Rules run on ${formatMonth(data.month)}`,
        description: r.checked
          ? `Of ${plural(r.checked, 'undecided row')}: ${r.approved} approved, ${r.suggested} to confirm, ${r.uncategorized} still uncategorized.`
          : 'Every row is already approved or decided by staff.',
        duration: 6,
      })
    } catch (err) {
      fail('Could not run the rules', err)
    } finally {
      setBusy(null)
    }
  }

  /** Sends the chosen uncategorized / AI rows to Claude, after a confirmation. */
  const askAi = (ids: number[]) => {
    if (!ai?.enabled || ids.length === 0) return
    modal.confirm({
      title: `Ask AI about ${plural(ids.length, 'row')}?`,
      icon: <RobotOutlined />,
      content: (
        <>
          <p style={{ marginTop: 0 }}>
            Their date, description, memo, amount and last 4 digits go to Claude ({ai.model}). Estimated cost:{' '}
            {estimateAiCost(ids.length)}.
          </p>
          <Typography.Text type="secondary">
            AI only suggests a category. Nothing is approved until you confirm it.
          </Typography.Text>
        </>
      ),
      okText: 'Ask AI',
      onOk: async () => {
        setBusy('ai')
        try {
          const r = await api<AskAiResult>(`/pharmacies/${pharmacyId}/transactions/ai`, {
            method: 'POST',
            body: JSON.stringify({ ids }),
          })
          refresh()
          const cost = r.costUsd === null ? '' : ` Cost about $${Number(r.costUsd).toFixed(3)}.`
          const placed = `AI suggested a category for ${r.suggested} of ${plural(r.sent, 'row')}.`
          const left = r.unplaced ? ` ${r.unplaced} it couldn't place (still in 9999).` : ''
          const skipped = r.skipped ? ` ${r.skipped} skipped (approved, or decided by a rule or a person).` : ''
          if (r.error) {
            notification.warning({ title: r.error, description: placed + left + skipped + cost, duration: 10 })
          } else {
            notification.success({
              title: 'AI suggestions ready',
              description: placed + left + skipped + cost,
              duration: 8,
            })
          }
        } catch (err) {
          fail('Could not ask AI', err)
        } finally {
          setBusy(null)
        }
      },
    })
  }

  if (accountsState.status === 'ready' && accounts.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        title="Add the pharmacy's bank and card accounts first"
        description="Every uploaded file belongs to one of the pharmacy's accounts."
        action={
          <Button size="small" type="primary" onClick={onAddAccounts}>
            Add accounts
          </Button>
        }
      />
    )
  }

  const columns: TableProps<Transaction>['columns'] = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 110,
      render: (d: string) => <span style={{ whiteSpace: 'nowrap' }}>{formatDay(d)}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (description: string, t) => (
        <>
          {description}
          {!accountId && <CellNote>{accountName(t.accountId)}</CellNote>}
          <CellNote>{t.memo}</CellNote>
          {t.flag === 'unknown_account' && (
            <Tag color="orange" style={{ marginTop: 4 }}>
              Unknown account •••• {t.lastFour}
            </Tag>
          )}
        </>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      align: 'right',
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (amount: string) => <Amount value={amount} />,
    },
    {
      title: 'Category',
      dataIndex: 'coaCode',
      width: 300,
      render: (code: string, t) => (
        <>
          <Select
            size="small"
            value={code}
            loading={busy === t.id}
            disabled={busy === t.id}
            onChange={(next: string) => {
              if (next !== code) void setAccount(t, next)
            }}
            showSearch={{ optionFilterProp: 'label' }}
            popupMatchSelectWidth={false}
            options={[{ value: UNCATEGORIZED_CODE, label: '9999 · Uncategorized' }, ...accountOptions]}
            style={{ width: '100%' }}
          />
          <CellNote>{reasonFor(t)}</CellNote>
          {t.source === 'ai' && (t.aiConfidence ?? 0) < LOW_CONFIDENCE && (
            <Tag color="orange" style={{ marginTop: 4 }}>
              Low confidence
            </Tag>
          )}
          {t.subtag && (
            <Tooltip title={t.subtagNote ?? undefined}>
              <Tag color="purple" style={{ marginTop: 4 }}>
                {t.subtag}
              </Tag>
            </Tooltip>
          )}
          <QuestionBlock
            t={t}
            busy={busy === t.id}
            onAccept={() => acceptAnswer(t)}
            onCancel={() => cancelQuestion(t)}
          />
        </>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 190,
      render: (status: TransactionStatus, t) => (
        <Space size={4} wrap>
          <Tag color={STATUS_TAGS[status].color}>{STATUS_TAGS[status].label}</Tag>
          {status === 'suggested' && (
            <Button size="small" icon={<CheckOutlined />} loading={busy === t.id} onClick={() => approve([t.id])}>
              Approve
            </Button>
          )}
          {status === 'approved' && (
            <Button
              size="small"
              type="text"
              icon={<UndoOutlined />}
              loading={busy === t.id}
              onClick={() => approve([t.id], true)}
              title="Take approval back"
            >
              Undo
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const uploadColumns: TableProps<Upload>['columns'] = [
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      render: (at: string, u) => (
        <>
          {new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          <CellNote>{`by ${u.uploadedBy}`}</CellNote>
        </>
      ),
    },
    { title: 'File', dataIndex: 'fileName' },
    { title: 'Account', dataIndex: 'accountId', render: (id: number) => accountName(id) },
    { title: 'Months', dataIndex: 'months', render: (m: string[]) => m.map(formatMonth).join(', ') },
    {
      title: 'Rows',
      key: 'rows',
      render: (_, u) => (
        <Space size={4} wrap>
          <Tag color="green">{u.rowsAdded} added</Tag>
          {u.rowsSkipped > 0 && <Tag>{u.rowsSkipped} already loaded</Tag>}
          {u.rowsHeld > 0 && <Tag color="gold">{u.rowsHeld} held</Tag>}
        </Space>
      ),
    },
  ]

  const totals = data?.totals
  const toReview = totals ? totals.suggested + totals.uncategorized : 0
  const chosen = (data?.transactions ?? []).filter((t) => selected.includes(t.id))
  const toApprove = chosen.filter((t) => t.status === 'suggested').map((t) => t.id)
  const forAi = chosen.filter(canAskAi).map((t) => t.id)
  const forOwner = chosen.filter(canAskOwner)
  const uncategorizedShown = rows.filter((t) => t.status === 'uncategorized').map((t) => t.id)
  const summary =
    data?.month && totals ? (
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Space size={16} wrap>
          <Typography.Text strong>
            {formatMonth(data.month)} · {plural(totals.count, 'transaction')}
          </Typography.Text>
          <span>
            In <Amount value={totals.moneyIn} />
          </span>
          <span>
            Out <Amount value={totals.moneyOut} />
          </span>
          <Typography.Text type="secondary">
            {totals.approved} approved · {totals.suggested} to confirm · {totals.uncategorized} uncategorized
            {totals.questionsWaiting > 0 && ` · ${totals.questionsWaiting} waiting on owner`}
            {totals.questionsAnswered > 0 && ` · ${totals.questionsAnswered} answered by owner`}
          </Typography.Text>
        </Space>
        <Space wrap>
          {uncategorizedShown.length > 0 && (
            <Button size="small" type="link" onClick={() => setSelected(uncategorizedShown)}>
              Select all uncategorized ({uncategorizedShown.length})
            </Button>
          )}
          {selected.length > 0 && (
            <>
              <Button size="small" type="link" onClick={() => setSelected([])}>
                Clear selection
              </Button>
              <Button
                icon={<CheckOutlined />}
                loading={busy === 'bulk'}
                disabled={toApprove.length === 0}
                onClick={() => approve(toApprove)}
              >
                Approve ({toApprove.length})
              </Button>
              <Tooltip
                title={
                  ai && !ai.enabled
                    ? 'AI is not set up: add ANTHROPIC_API_KEY to the backend .env file.'
                    : forAi.length === 0
                      ? 'Only uncategorized rows and earlier AI suggestions can go to AI.'
                      : undefined
                }
              >
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  loading={busy === 'ai'}
                  disabled={!ai?.enabled || forAi.length === 0}
                  onClick={() => askAi(forAi)}
                >
                  Ask AI ({forAi.length})
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  forOwner.length === 0 ? 'Approved rows and rows already asked about are left out.' : undefined
                }
              >
                <Button
                  icon={<QuestionCircleOutlined />}
                  disabled={forOwner.length === 0}
                  onClick={() => setAskingOwner(forOwner)}
                >
                  Ask owner ({forOwner.length})
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      </Flex>
    ) : null

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 12 }}>
        <Flex wrap gap={12}>
          <Select<number | 'all'>
            value={accountId ?? 'all'}
            onChange={(v) => {
              setAccountId(v === 'all' ? undefined : v)
              setMonth(undefined)
              setSelected([])
            }}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a) => ({ value: a.id, label: accountName(a.id) })),
            ]}
            style={{ minWidth: 240 }}
          />
          <Select<string>
            value={data?.month ?? undefined}
            onChange={(m) => {
              setMonth(m)
              setSelected([])
            }}
            placeholder="No months yet"
            disabled={!data?.months.length}
            options={(data?.months ?? []).map((m) => ({ value: m, label: formatMonth(m) }))}
            style={{ width: 140 }}
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search description, amount or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
        </Flex>
        <Space wrap>
          <Button
            icon={<SyncOutlined />}
            onClick={() => runRules()}
            loading={busy === 'run'}
            disabled={!data?.month}
            title="Apply the current rules to rows nobody has decided yet"
          >
            Run rules again
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadKey(Date.now())}
            disabled={openAccounts.length === 0}
          >
            Upload CSV
          </Button>
        </Space>
      </Flex>

      <Segmented<View>
        value={view}
        onChange={(v) => {
          setView(v)
          setSelected([])
        }}
        options={[
          { value: 'review', label: `To review${totals ? ` (${toReview})` : ''}` },
          { value: 'approved', label: `Approved${totals ? ` (${totals.approved})` : ''}` },
          { value: 'all', label: 'All' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {state.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          title={state.message}
          action={
            <Button size="small" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : (
        <Table<Transaction>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={state.status === 'loading'}
          pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 960 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as number[]),
            // Approved rows are final; take approval back first to change them.
            getCheckboxProps: (t) => ({ disabled: t.status === 'approved' }),
          }}
          locale={{
            emptyText: !data?.months.length
              ? 'No transactions yet. Upload a bank or card CSV to start.'
              : view === 'review' && !search
                ? `Nothing left to review in ${data.month ? formatMonth(data.month) : 'this month'}.`
                : 'No transactions match.',
          }}
          title={summary ? () => summary : undefined}
        />
      )}

      <Typography.Title level={5} style={{ marginTop: 32 }}>
        Upload history
      </Typography.Title>
      {uploads.state.status === 'error' ? (
        <Alert type="error" showIcon title={uploads.state.message} />
      ) : (
        <Table<Upload>
          rowKey="id"
          size="small"
          columns={uploadColumns}
          dataSource={uploads.state.status === 'ready' ? uploads.state.uploads : []}
          loading={uploads.state.status === 'loading'}
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 760 }}
          locale={{ emptyText: 'No uploads yet.' }}
        />
      )}

      {uploadKey !== null && (
        <UploadModal
          key={uploadKey}
          open
          pharmacyId={pharmacyId}
          accounts={openAccounts}
          onClose={() => setUploadKey(null)}
          onImported={onImported}
        />
      )}

      {askingOwner && (
        <AskOwnerModal
          pharmacyId={pharmacyId}
          rows={askingOwner}
          options={accountOptions}
          openInMonth={(totals?.questionsWaiting ?? 0) + (totals?.questionsAnswered ?? 0)}
          onClose={() => setAskingOwner(null)}
          onAsked={onAskedOwner}
        />
      )}

      <RuleFormModal
        open={ruleDefaults !== null}
        rule={null}
        pharmacyId={pharmacyId}
        listName={pharmacyName}
        accounts={coaAccounts}
        defaults={ruleDefaults ?? undefined}
        onClose={() => setRuleDefaults(null)}
        onSaved={(saved) => {
          setRuleDefaults(null)
          void runRules(`Rule ${saved.keyword} added`)
        }}
      />
    </>
  )
}

/** Where a question to the owner stands, with the actions that fit. */
function QuestionBlock({
  t,
  busy,
  onAccept,
  onCancel,
}: {
  t: Transaction
  busy: boolean
  onAccept: () => void
  onCancel: () => void
}) {
  const q = t.question
  if (!q || q.status === 'cancelled') return null
  if (q.status === 'waiting') {
    return (
      <Flex align="center" gap={4} wrap style={{ marginTop: 4 }}>
        <Tag color="blue">Asked owner {formatDay(q.askedAt.slice(0, 10))}</Tag>
        <Button size="small" type="link" onClick={onCancel} loading={busy} style={{ padding: 0 }}>
          Cancel
        </Button>
        <CellNote>{q.staffNote ? `Your note: ${q.staffNote}` : null}</CellNote>
      </Flex>
    )
  }
  if (q.status === 'answered') {
    const answer = q.answerUnsure ? 'Not sure — asks you to decide' : (q.answerLabel ?? '')
    return (
      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(250, 173, 20, 0.08)' }}>
        <Tag color="gold">Owner answered</Tag>
        <Typography.Text style={{ fontSize: 13 }}>{answer}</Typography.Text>
        <CellNote>{q.answerNote ? `"${q.answerNote}"` : null}</CellNote>
        {q.willSendDocument && <Tag style={{ marginTop: 4 }}>Will send a document</Tag>}
        <Flex gap={8} style={{ marginTop: 4 }}>
          {!q.answerUnsure && (
            <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy} onClick={onAccept}>
              Accept
            </Button>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {q.answerUnsure ? 'Pick the category above.' : 'Or pick another category above to override.'}
          </Typography.Text>
        </Flex>
      </div>
    )
  }
  return (
    <CellNote>
      {q.status === 'accepted'
        ? null
        : `Owner answered ${q.answerUnsure ? '"not sure"' : (q.answerLabel ?? '')}; overridden by staff`}
    </CellNote>
  )
}
