import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import type { PharmacyAccount } from './account.ts'

type State =
  { status: 'loading' } | { status: 'ready'; accounts: PharmacyAccount[] } | { status: 'error'; message: string }

/** Loads a pharmacy's bank and card accounts; `reload` fetches them again after a change. */
export function usePharmacyAccounts(pharmacyId: number) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<PharmacyAccount[]>(`/pharmacies/${pharmacyId}/accounts`)
      .then((accounts) => {
        if (!cancelled) setState({ status: 'ready', accounts })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load the accounts.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [pharmacyId, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { state, reload }
}
