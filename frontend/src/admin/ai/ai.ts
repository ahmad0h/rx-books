/** A version of the AI instructions, as returned by /api/ai/prompts. */
export interface PromptVersion {
  version: number
  body: string
  createdBy: string
  createdAt: string
}

/** One "Ask AI", as returned by /api/ai/runs. */
export interface AiRun {
  id: number
  pharmacyId: number
  promptVersion: number
  model: string
  requestedBy: string
  rowsSent: number
  rowsSuggested: number
  rowsUnplaced: number
  batches: number
  batchesFailed: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  costUsd: string | null
  error: string | null
  createdAt: string
}
