export interface ShoppingListRealtimeEvent {
  eventType: string
  listId: string
  itemId: string | null
  actorDisplayName: string
  occurredAt: string
}

export function shouldUseRealtimeSocket() {
  if (typeof WebSocket !== 'function') {
    return false
  }

  return !isStandaloneWebApp()
}

export function openListRealtimeSocket(listId: string) {
  return new WebSocket(listRealtimeUrl(listId))
}

function listRealtimeUrl(listId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/lists/${encodeURIComponent(listId)}`
}

function isStandaloneWebApp() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean }
  const standaloneDisplayMode =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches

  return standaloneDisplayMode || standaloneNavigator.standalone === true
}
