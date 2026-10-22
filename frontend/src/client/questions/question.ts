/** A question as the owner sees it: plain words, no account codes. */
export interface OwnerQuestionCard {
  id: number
  date: string
  description: string
  amount: string
  /** "Business credit card •••• 7702" */
  account: string
  /** The starting choice (a category value), if RxBooks suggested one. */
  suggested: string | null
  /** A note from RxBooks. */
  note: string | null
  status: 'waiting' | 'answered'
  answer: { category: string; note: string | null; willSendDocument: boolean; answeredAt: string } | null
}

export interface OwnerCategory {
  value: string
  label: string
  group: string
}

/** The value for "Not sure, you decide". */
export const UNSURE = 'unsure'
