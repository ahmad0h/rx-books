import type { CoaAccount } from '../../coa/coa.ts'

export type AccountKind = 'checking' | 'savings' | 'credit_card'

export const KIND_LABELS: Record<AccountKind, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
}

/** A pharmacy's bank or card account, as returned by /api/pharmacies/:id/accounts. */
export interface PharmacyAccount {
  id: number
  pharmacyId: number
  name: string
  kind: AccountKind
  bank: string
  lastFour: string
  coaCode: string
  /** "1010 · Cash — checking 1" */
  coaLabel: string
  /** "YYYY-MM-DD" */
  openedOn: string | null
  closedOn: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type PharmacyAccountInput = Pick<
  PharmacyAccount,
  'name' | 'kind' | 'bank' | 'lastFour' | 'coaCode' | 'openedOn' | 'closedOn' | 'notes'
>

/** Banks to suggest; any other name can be typed. */
export const COMMON_BANKS = ['US Bank', 'Chase', 'American Express', 'Wells Fargo', 'Bank of America', 'Bremer Bank']

/** Same rule as the backend: checking and savings use 10xx (not 1015), cards use 2010–2099. */
export function codeFitsKind(kind: AccountKind, account: CoaAccount): boolean {
  const code = Number(account.code)
  if (kind === 'credit_card') return account.type === 'liability' && code >= 2010 && code <= 2099
  return account.type === 'asset' && code >= 1000 && code <= 1099 && account.code !== '1015'
}

/** "YYYY-MM-DD" for today, in the browser's time zone. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2025-06-30" → "Jun 30, 2025" without time-zone shifts. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
