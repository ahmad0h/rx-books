import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { Pharmacy } from './pharmacy.ts'

type State = { status: 'loading' } | { status: 'ready'; pharmacy: Pharmacy } | { status: 'error'; message: string }

/** Loads one pharmacy; `reload` fetches it again after an edit. */
export function usePharmacy(id: number) {
  const [version, setVersion] = useState(0)
  const request = `${id}#${version}`
  const [loaded, setLoaded] = useState<{ request: string; state: State } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Pharmacy>(`/pharmacies/${id}`)
      .then((pharmacy) => {
        if (!cancelled) setLoaded({ request, state: { status: 'ready', pharmacy } })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({
            request,
            state: { status: 'error', message: err instanceof ApiError ? err.message : 'Could not load the pharmacy.' },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, request])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // After an edit the same pharmacy stays on screen while it reloads.
  const state: State = loaded?.request.startsWith(`${id}#`) ? loaded.state : { status: 'loading' }
  return { state, reload }
}
