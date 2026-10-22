import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../shared/api.ts'
import type { OwnerCategory, OwnerQuestionCard } from './question.ts'

type State =
  | { status: 'loading' }
  | { status: 'ready'; pharmacyName: string; questions: OwnerQuestionCard[]; categories: OwnerCategory[] }
  | { status: 'error'; message: string }

/** The owner's open questions and the categories they can pick. */
export function useOwnerQuestions() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<{ pharmacyName: string; questions: OwnerQuestionCard[] }>('/client/questions'),
      api<OwnerCategory[]>('/client/categories'),
    ])
      .then(([q, categories]) => {
        if (!cancelled) setState({ status: 'ready', ...q, categories })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load your questions.',
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
