const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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
  }
}

let authToken: string | null = null
let devActor: Actor | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function setDevActor(actor: Actor | null) {
  devActor = actor
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

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  } else if (devActor) {
    headers['x-naeos-dev-user'] = JSON.stringify(devActor)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

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

export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}