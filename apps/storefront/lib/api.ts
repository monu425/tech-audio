const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string> | null

  constructor(
    message: string,
    status: number,
    code = 'ERROR',
    fields: Record<string, string> | null = null
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export type Envelope<T> = { success: boolean; message: string; data: T }

async function parseResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const body = (payload ?? {}) as Record<string, unknown>
    const error = (body.error ?? {}) as {
      message?: string
      code?: string
      fields?: Record<string, string>
    }
    throw new ApiError(
      error?.message ?? (body.message as string) ?? fallbackMessage,
      res.status,
      error?.code ?? 'ERROR',
      error?.fields ?? null
    )
  }

  const envelope = payload as Envelope<T>
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope)) {
    return payload as T
  }
  if (!envelope.success) {
    throw new ApiError(envelope.message, res.status, 'ERROR', null)
  }
  return envelope.data as T
}

export async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
  } = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...headers },
    signal
  }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${API_BASE}${path}`, init)
  return parseResponse<T>(res, 'Request failed')
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body })
}

export function patchJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body })
}

export function putJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body })
}

export function deleteJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', body })
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
