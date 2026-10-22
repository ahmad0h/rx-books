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
  status: 'uncategorized' | 'suggested' | 'approved'
}

export interface TransactionMonth {
  /** Months with transactions, newest first ("2025-02"). */
  months: string[]
  month: string | null
  transactions: Transaction[]
  totals: { count: number; moneyIn: string; moneyOut: string }
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
