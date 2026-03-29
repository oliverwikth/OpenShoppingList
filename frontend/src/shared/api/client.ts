import type { ApiErrorResponse } from '../types/api'
import { reportClientError } from '../errorReporting'

type HttpMethod = 'GET' | 'POST' | 'PATCH'

interface RequestOptions {
  method?: HttpMethod
  actorName?: string
  body?: unknown
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', actorName, body, signal } = options
  let response: Response

  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(actorName ? { 'X-Actor-Display-Name': actorName } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (path !== '/api/error-reports') {
      await reportClientError('FRONTEND_NETWORK', error instanceof Error ? error : new Error('Network request failed'), { path })
    }
    throw error
  }

  if (!response.ok) {
    let message = 'Något gick fel.'

    try {
      const errorBody = (await response.json()) as ApiErrorResponse
      message = errorBody.message
    } catch {
      message = response.statusText || message
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const rawBody = await response.text()
  if (!rawBody.trim()) {
    return undefined as T
  }

  return JSON.parse(rawBody) as T
}
