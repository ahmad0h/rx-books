/** Same lists as the backend (coa-account.entity.ts). */
export const ACCOUNT_TYPES = ['revenue', 'cost_of_goods', 'expense', 'asset', 'liability', 'equity', 'review'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const EXPENSE_GROUPS = ['Labor', 'Occupancy', 'Regulatory', 'Professional', 'General'] as const
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number]

/** Where every transaction starts. Always active and open for transactions. */
export const UNCATEGORIZED_CODE = '9999'

export const TYPE_LABELS: Record<AccountType, string> = {
  revenue: 'Revenue',
  cost_of_goods: 'Cost of goods sold',
  expense: 'Operating expenses',
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  review: 'Needs review',
}

export const TYPE_COLORS: Record<AccountType, string> = {
  revenue: 'green',
  cost_of_goods: 'orange',
  expense: 'volcano',
  asset: 'blue',
  liability: 'purple',
  equity: 'geekblue',
  review: 'gold',
}

/** An account, as returned by /api/coa. */
export interface CoaAccount {
  code: string
  /** "6110 · Rent" */
  label: string
  name: string
  type: AccountType
  expenseGroup: ExpenseGroup | null
  description: string | null
  ownerLabel: string | null
  categorizable: boolean
  contraOf: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** What the add form sends. Edits send the same without `code`, plus `isActive`. */
export type CoaInput = Pick<
  CoaAccount,
  'code' | 'name' | 'type' | 'expenseGroup' | 'description' | 'ownerLabel' | 'categorizable' | 'contraOf'
>
