interface ReportContext {
  path?: string
}

let handlersInstalled = false

export function installGlobalErrorHandlers() {
  if (handlersInstalled || typeof window === 'undefined') {
    return
  }

  handlersInstalled = true

  window.addEventListener('error', (event) => {
    const fallbackMessage = event.message?.trim() || 'Unknown runtime error'
    const error = event.error instanceof Error ? event.error : new Error(fallbackMessage)
    void reportClientError('FRONTEND_RUNTIME', error)
  })

  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError('FRONTEND_PROMISE', normalizeUnknownError(event.reason))
  })
}

export async function reportClientError(source: string, error: Error, context: ReportContext = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const path = context.path ?? window.location.pathname
  if (path === '/api/error-reports') {
    return
  }

  const actorName = resolveActorName(path)

  try {
    await fetch('/api/error-reports', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(actorName ? { 'X-Actor-Display-Name': actorName } : {}),
      },
      body: JSON.stringify({
        source,
        message: error.message || 'Unknown client error',
        stack: error.stack ?? null,
        path,
        userAgent: window.navigator.userAgent,
      }),
    })
  } catch {
    // Swallow reporting failures to avoid recursive client error loops.
  }
}

function resolveActorName(path: string) {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? segments[0] : null
}

function normalizeUnknownError(value: unknown) {
  if (value instanceof Error) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return new Error(value)
  }

  return new Error('Unhandled promise rejection')
}
