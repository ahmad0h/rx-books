import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { Rule, RuleList } from './rule.ts'

type State = { status: 'loading' } | { status: 'ready'; rules: Rule[] } | { status: 'error'; message: string }

/** Loads one list of rules (retired ones included); `reload` fetches it again after a change. */
export function useRules(list: RuleList) {
  const [version, setVersion] = useState(0)
  const request = `${list}#${version}`
  const [loaded, setLoaded] = useState<{ request: string; state: State } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Rule[]>(`/rules?pharmacy=${list}`)
      .then((rules) => {
        if (!cancelled) setLoaded({ request, state: { status: 'ready', rules } })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            request,
            state: { status: 'error', message: err instanceof ApiError ? err.message : 'Could not load the rules.' },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [list, request])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // After a save the same list stays on screen while it reloads; another list shows "loading".
  const state: State = loaded?.request.startsWith(`${list}#`) ? loaded.state : { status: 'loading' }
  return { state, reload }
}
