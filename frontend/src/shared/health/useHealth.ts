import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, type HealthReport } from './health.ts'

export type HealthState =
  | { kind: 'loading' }
  | { kind: 'reachable'; report: HealthReport; checkedAt: Date }
  | { kind: 'unreachable'; error: string; checkedAt: Date }

const POLL_INTERVAL_MS = 30_000

/** Polls /api/health so the console always shows whether the backend is up. */
export function useHealth() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const check = async () => {
      try {
        const report = await fetchHealth(controller.signal)
        setState({ kind: 'reachable', report, checkedAt: new Date() })
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({ kind: 'unreachable', error: message, checkedAt: new Date() })
      }
    }

    void check()
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [refreshKey])

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])
  return { state, refresh }
}
