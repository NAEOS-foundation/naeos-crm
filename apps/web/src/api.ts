const API_BASE = import.meta.env.VITE_API_URL || ''

export interface Actor {
  id: string
  email: string
  roles: string[]
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) return undefined as T

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string } }
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? 'UNKNOWN',
      errorPayload?.error?.message ?? `Request failed with status ${response.status}`,
    )
  }

  return payload as T
}
