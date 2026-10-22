import { useEffect, useState } from 'react'
import { api } from '../../../shared/api.ts'
import type { AiStatus } from './transaction.ts'

/** Whether AI is set up on the server, and with which model. Null while loading or on error. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    api<AiStatus>('/ai/status')
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false, model: '', promptVersion: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [])
  return status
}
