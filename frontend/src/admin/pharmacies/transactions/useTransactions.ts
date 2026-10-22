import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import type { TransactionMonth } from './transaction.ts'

type State = { status: 'loading' } | { status: 'ready'; data: TransactionMonth } | { status: 'error'; message: string }

/**
 * One month of a pharmacy's transactions. Without a month the newest is shown.
 * `reload` fetches again after an upload.
 */
export function useTransactions(pharmacyId: number, filter: { month?: string; accountId?: number }) {
  const [version, setVersion] = useState(0)
  const query = new URLSearchParams()
  if (filter.month) query.set('month', filter.month)
  if (filter.accountId) query.set('accountId', String(filter.accountId))
  const search = query.toString()
  const path = `/pharmacies/${pharmacyId}/transactions${search ? `?${search}` : ''}`
  const request = `${path}#${version}`
  const [loaded, setLoaded] = useState<{ request: string; state: State } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<TransactionMonth>(path)
      .then((data) => {
        if (!cancelled) setLoaded({ request, state: { status: 'ready', data } })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            request,
            state: {
              status: 'error',
              message: err instanceof ApiError ? err.message : 'Could not load the transactions.',
            },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [path, request])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // While the same filter reloads, the old rows stay on screen.
  const state: State = loaded?.request.startsWith(`${path}#`) ? loaded.state : { status: 'loading' }
  return { state, reload }
}
