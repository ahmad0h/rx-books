/** Error from the backend, with a message that is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function messageFrom(body: unknown, status: number): string {
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown }
    if (typeof message === 'string') return message
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  }
  return status >= 500 ? 'Something went wrong on our side. Please try again.' : `Request failed (${status}).`
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
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, res.status))
  return body as T
}
