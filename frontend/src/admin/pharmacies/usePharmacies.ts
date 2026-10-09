import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { Pharmacy } from './pharmacy.ts'

type State =
  | { status: 'loading' }
  | { status: 'ready'; pharmacies: Pharmacy[] }
  | { status: 'error'; message: string }

/** Loads all pharmacies; `reload` fetches them again after a change. */
export function usePharmacies() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<Pharmacy[]>('/pharmacies')
      .then((pharmacies) => {
        if (!cancelled) setState({ status: 'ready', pharmacies })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load pharmacies.',
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
