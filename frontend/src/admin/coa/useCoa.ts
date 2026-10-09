import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { CoaAccount } from './coa.ts'

type State = { status: 'loading' } | { status: 'ready'; accounts: CoaAccount[] } | { status: 'error'; message: string }

/** Loads every account, sorted by code; `reload` fetches them again after a change. */
export function useCoa() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<CoaAccount[]>('/coa')
      .then((accounts) => {
        if (!cancelled) setState({ status: 'ready', accounts })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load the chart of accounts.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { state, reload }
}
