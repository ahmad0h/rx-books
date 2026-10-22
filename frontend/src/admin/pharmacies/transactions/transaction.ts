/** A bank or card transaction, as returned by /api/pharmacies/:id/transactions. */
export interface Transaction {
  id: number
  accountId: number
  uploadId: number
  /** "YYYY-MM-DD" */
  date: string
  postDate: string | null
  description: string
  memo: string | null
  /** Exact decimal, e.g. "-3120.40". Negative = money out. */
  amount: string
  typeHint: string | null
  lastFour: string | null
  coaCode: string
  coaLabel: string
  status: TransactionStatus
  /** How the account was chosen; null while uncategorized. */
  source: 'rule' | 'own_account' | 'ai' | 'staff' | null
  ruleId: number | null
  ruleKeyword: string | null
  flag: 'unknown_account' | null
  /** Who approved it; null when an auto-approve rule did. */
  approvedBy: string | null
  approvedAt: string | null
  /** The AI's answer, when it was asked about this row (0–100). */
  aiConfidence: number | null
  aiRationale: string | null
  aiRunId: number | null
  /** Only for 2510 · Owner draw. */
  subtag: 'personal' | 'distribution' | 'charity' | null
  subtagNote: string | null
}

/** Below this, an AI suggestion is marked "low confidence". */
export const LOW_CONFIDENCE = 60

/** Rows that can go to AI: not approved, and not decided by a rule or a person. */
export function canAskAi(t: Transaction): boolean {
  return t.status !== 'approved' && (t.source === null || t.source === 'ai')
}

/** What "Ask AI" returns. */
export interface AskAiResult {
  runId: number
  sent: number
  suggested: number
  unplaced: number
  skipped: number
  batches: number
  batchesFailed: number
  costUsd: string | null
  error: string | null
}

export interface AiStatus {
  enabled: boolean
  model: string
  promptVersion: number
}

export type TransactionStatus = 'uncategorized' | 'suggested' | 'approved'

/** What a rule run did. */
export interface CategorizeResult {
  checked: number
  approved: number
  suggested: number
  uncategorized: number
}

export interface TransactionMonth {
  /** Months with transactions, newest first ("2025-02"). */
  months: string[]
  month: string | null
  transactions: Transaction[]
  totals: {
    count: number
    moneyIn: string
    moneyOut: string
    approved: number
    suggested: number
    uncategorized: number
  }
}

export interface Upload {
  id: number
  accountId: number
  fileName: string
  format: string
  uploadedBy: string
  rowsInFile: number
  rowsAdded: number
  rowsSkipped: number
  rowsHeld: number
  firstDate: string
  lastDate: string
  months: string[]
  createdAt: string
}

/** An import, plus what the rules did with its new rows. */
export interface ImportResult extends Upload {
  categorization: CategorizeResult
}

export type RowStatus = 'new' | 'loaded' | 'held'

export interface UploadPreview {
  fileName: string
  format: { id: string; label: string }
  account: { id: number; name: string; lastFour: string }
  summary: {
    rows: number
    new: number
    loaded: number
    held: number
    firstDate: string
    lastDate: string
    months: string[]
    moneyIn: string
    moneyOut: string
  }
  warnings: string[]
  rows: {
    line: number
    date: string
    description: string
    memo: string | null
    amount: string
    lastFour: string | null
    status: RowStatus
  }[]
}

/** Same limit as the backend: about 2 MB of text. */
export const MAX_FILE_BYTES = 2_000_000

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** "-3120.40" → "-$3,120.40" */
export function formatMoney(amount: string): string {
  return usd.format(Number(amount))
}

/** "2025-01" → "Jan 2025" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** Why a transaction has its account, in a few words. */
export function reasonFor(t: Transaction): string | null {
  const approver = t.approvedBy ? ` · approved by ${t.approvedBy}` : ''
  switch (t.source) {
    case 'rule':
      return (
        `Rule ${t.ruleKeyword ?? ''}`.trim() + (t.status === 'approved' && !t.approvedBy ? ' · automatic' : approver)
      )
    case 'own_account':
      return `Transfer to own account •••• ${t.lastFour ?? ''}` + approver
    case 'ai':
      return `AI · ${t.aiConfidence ?? 0}%${t.aiRationale ? ` · ${t.aiRationale}` : ''}` + approver
    case 'staff':
      return `Chosen by ${t.approvedBy ?? 'staff'}`
    default:
      // The AI was asked but couldn't place it.
      return t.aiRunId !== null ? `AI couldn't place it${t.aiRationale ? `: ${t.aiRationale}` : ''}` : null
  }
}

/** Words that describe how money moved, not who it went to. */
const PAYMENT_WORDS = new Set([
  'ELECTRONIC',
  'DEPOSIT',
  'WITHDRAWAL',
  'WEB',
  'AUTHORIZED',
  'PMT',
  'PAYMENT',
  'MOBILE',
  'BANKING',
  'POS',
  'PURCHASE',
  'ACH',
  'DEBIT',
  'CREDIT',
])

/**
 * A starting keyword for a rule made from a transaction: the vendor part of the
 * description, without leading payment words or numbers. "ELECTRONIC WITHDRAWAL
 * XCEL ENERGY" → "XCEL ENERGY", "COSTCO GAS #0999" → "COSTCO GAS". The person can edit it.
 */
export function suggestKeyword(description: string): string {
  const words = description.toUpperCase().split(/\s+/).filter(Boolean)
  while (words.length > 1 && PAYMENT_WORDS.has(words[0])) words.shift()
  return words
    .filter((w) => !/[0-9#*]/.test(w))
    .slice(0, 4)
    .join(' ')
}

/** A rough cost for asking AI about some rows, before it runs (the run log shows the real cost). */
export function estimateAiCost(rows: number): string {
  const batches = Math.ceil(rows / 40)
  // ~4k cached instruction tokens written once per batch at $5/M, ~60 input and
  // ~150 output tokens per row at $4/M and $20/M (Claude Opus 5.5 list prices).
  const dollars = batches * 0.02 + rows * (60 * 4 + 150 * 20) / 1_000_000
  return dollars < 0.01 ? 'under $0.01' : `about $${dollars.toFixed(2)}`
}
