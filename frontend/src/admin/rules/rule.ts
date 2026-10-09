export type RuleSource = 'import' | 'manual' | 'ai_review' | 'client_confirmed'

export const SOURCE_LABELS: Record<RuleSource, string> = {
  import: 'Imported',
  manual: 'Added by staff',
  ai_review: 'From AI review',
  client_confirmed: 'Owner confirmed',
}

/** A rule, as returned by /api/rules. */
export interface Rule {
  id: number
  /** null = shared rule for every pharmacy. */
  pharmacyId: number | null
  keyword: string
  coaCode: string
  /** "5010 · Rx drugs — wholesale" */
  account: string
  tag: string | null
  priority: number
  autoApprove: boolean
  source: RuleSource
  sourceNote: string | null
  createdAt: string
  updatedAt: string
  retiredAt: string | null
}

/** What the add / edit form sends. */
export interface RuleInput {
  keyword: string
  coaCode: string
  tag: string | null
  priority: number | null
  autoApprove: boolean
  sourceNote: string | null
}

export interface RuleTestResult {
  winner: Rule | null
  matches: Rule[]
}

/** Which list is shown: the shared rules, or one pharmacy's. */
export type RuleList = 'shared' | number
