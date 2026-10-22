/** Error from the backend, with a message that is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number
  /** Every message the server sent (e.g. one per bad row in a file). `message` is the first. */
  readonly messages: string[]

  constructor(status: number, messages: string | string[]) {
    const list = Array.isArray(messages) ? messages : [messages]
    super(list[0])
    this.name = 'ApiError'
    this.status = status
    this.messages = list
  }
}

function messagesFrom(body: unknown, status: number): string[] {
  if (status === 429) return ['Too many attempts. Wait a minute and try again.']
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown }
    if (typeof message === 'string') return [message]
    if (Array.isArray(message) && message.length > 0 && message.every((m) => typeof m === 'string')) {
      return message as string[]
    }
  }
  return [status >= 500 ? 'Something went wrong on our side. Please try again.' : `Request failed (${status}).`]
}

/**
 * Calls the backend under /api. The session cookie is sent automatically
 * because the app and the API share one origin.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  if (res.status === 204) return undefined as T
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, messagesFrom(body, res.status))
  return body as T
}
