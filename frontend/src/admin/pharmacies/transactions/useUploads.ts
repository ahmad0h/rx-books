import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../shared/api.ts'
import type { Upload } from './transaction.ts'

type State = { status: 'loading' } | { status: 'ready'; uploads: Upload[] } | { status: 'error'; message: string }

/** A pharmacy's upload history, newest first. */
export function useUploads(pharmacyId: number) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<Upload[]>(`/pharmacies/${pharmacyId}/uploads`)
      .then((uploads) => {
        if (!cancelled) setState({ status: 'ready', uploads })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load the upload history.',
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
