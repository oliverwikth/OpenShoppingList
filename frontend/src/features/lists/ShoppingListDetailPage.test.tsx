import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../app/AppShell'

const mockSockets: MockWebSocket[] = []

const initialList = {
  id: 'list-1',
  name: 'Veckohandling',
  status: 'ACTIVE',
  createdAt: '2026-03-26T18:00:00Z',
  updatedAt: '2026-03-26T18:00:00Z',
  lastModifiedByDisplayName: 'anna',
  items: [],
  recentActivities: [],
}

const updatedList = {
  ...initialList,
  updatedAt: '2026-03-26T18:05:00Z',
  lastModifiedByDisplayName: 'anna',
  items: [
    {
      id: 'item-1',
      itemType: 'MANUAL',
      title: 'Födelsedagsljus',
      checked: false,
      checkedAt: null,
      checkedByDisplayName: null,
      lastModifiedByDisplayName: 'anna',
      createdAt: '2026-03-26T18:05:00Z',
      updatedAt: '2026-03-26T18:05:00Z',
      position: 1,
      quantity: 1,
      manualNote: '',
      externalSnapshot: null,
    },
  ],
  recentActivities: [
    {
      id: 'activity-1',
      itemId: 'item-1',
      eventType: 'shopping-list-item.added',
      actorDisplayName: 'anna',
      occurredAt: '2026-03-26T18:05:00Z',
    },
  ],
}

describe('ShoppingListDetailPage', () => {
  beforeEach(() => {
    mockSockets.length = 0
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('moves checked items into a separate section at the bottom of the checklist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Tomater',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
            {
              id: 'item-2',
              itemType: 'MANUAL',
              title: 'Mjolk',
              checked: true,
              checkedAt: '2026-03-26T18:06:00Z',
              checkedByDisplayName: 'anna',
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:06:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 2,
              quantity: 2,
              manualNote: '',
              externalSnapshot: null,
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const { container } = render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/checklista']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Avprickade varor' })).toBeInTheDocument()
    expect(screen.getByText('Tomater')).toBeInTheDocument()
    expect(screen.getByText('Mjolk')).toBeInTheDocument()

    const content = container.textContent ?? ''
    expect(content.indexOf('Tomater')).toBeLessThan(content.indexOf('Avprickade varor'))
    expect(content.indexOf('Avprickade varor')).toBeLessThan(content.indexOf('Mjolk'))
  })

  it('adds a manual item from the search screen and reloads the list detail', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'item-1',
          itemType: 'EXTERNAL_ARTICLE',
          title: 'Födelsedagsljus',
          checked: false,
          checkedAt: null,
          checkedByDisplayName: null,
          lastModifiedByDisplayName: 'anna',
          createdAt: '2026-03-26T18:05:00Z',
          updatedAt: '2026-03-26T18:05:00Z',
          position: 1,
          quantity: 1,
          manualNote: '',
          externalSnapshot: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updatedList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: 'willys',
          query: 'Födelsedagsljus',
          available: true,
          message: null,
          results: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Öppna sök' }))
    await userEvent.type(screen.getByLabelText('Sök artikel'), 'Födelsedagsljus')
    await userEvent.click(screen.getByRole('button', { name: 'Lägg till Födelsedagsljus' }))

    expect(screen.getByLabelText('Sök artikel')).toHaveValue('Födelsedagsljus')
    expect(await screen.findByRole('button', { name: 'Minska Födelsedagsljus' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Öka Födelsedagsljus' })).toBeInTheDocument()
    expect(await screen.findByText('Födelsedagsljus')).toBeInTheDocument()
    expect(await screen.findByText('1')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lists/list-1/items/manual',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
        }),
      )
    })
  })

  it('uses varor as the back target from the search view', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '←' })).toHaveAttribute('href', '/anna/lists/list-1/varor')
  })

  it('claims an unchecked checklist item when swiped left', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Tomater',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              claimedAt: null,
              claimedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'item-1',
          itemType: 'MANUAL',
          title: 'Tomater',
          checked: false,
          checkedAt: null,
          checkedByDisplayName: null,
          claimedAt: '2026-03-26T18:06:00Z',
          claimedByDisplayName: 'anna',
          lastModifiedByDisplayName: 'anna',
          createdAt: '2026-03-26T18:05:00Z',
          updatedAt: '2026-03-26T18:06:00Z',
          position: 1,
          quantity: 1,
          manualNote: '',
          externalSnapshot: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Tomater',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              claimedAt: '2026-03-26T18:06:00Z',
              claimedByDisplayName: 'anna',
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/checklista']}>
        <AppShell />
      </MemoryRouter>,
    )

    const article = (await screen.findByText('Tomater')).closest('article')
    expect(article).not.toBeNull()

    fireEvent.pointerDown(article!, { clientX: 220 })
    fireEvent.pointerMove(article!, { clientX: 110 })
    fireEvent.pointerUp(article!, { clientX: 110 })

    expect(await screen.findByText('anna hämtar')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lists/list-1/items/item-1/claim',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
        }),
      )
    })
  })

  it('increments and decrements an item from the varor view', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Kaffe',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:00Z',
              position: 1,
              quantity: 2,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: 'coffee-1',
                subtitle: '500g',
                imageUrl: null,
                category: 'Dryck',
                priceAmount: 87.5,
                currency: 'SEK',
              },
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'item-1',
          itemType: 'MANUAL',
          title: 'Kaffe',
          checked: false,
          checkedAt: null,
          checkedByDisplayName: null,
          lastModifiedByDisplayName: 'anna',
          createdAt: '2026-03-26T18:05:00Z',
          updatedAt: '2026-03-26T18:05:30Z',
          position: 1,
          quantity: 3,
          manualNote: '',
          externalSnapshot: {
            provider: 'willys',
            articleId: 'coffee-1',
            subtitle: '500g',
            imageUrl: null,
            category: 'Dryck',
            priceAmount: 87.5,
            currency: 'SEK',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Kaffe',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:30Z',
              position: 1,
              quantity: 3,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: 'coffee-1',
                subtitle: '500g',
                imageUrl: null,
                category: 'Dryck',
                priceAmount: 87.5,
                currency: 'SEK',
              },
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Kaffe',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 2,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: 'coffee-1',
                subtitle: '500g',
                imageUrl: null,
                category: 'Dryck',
                priceAmount: 87.5,
                currency: 'SEK',
              },
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Kaffe')).toBeInTheDocument()
    expect(screen.getByText('175.00 SEK')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe' }))

    expect(await screen.findByText('262.50 SEK')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lists/list-1/items/external',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
        }),
      )
    })

    await userEvent.click(screen.getByRole('button', { name: 'Minska Kaffe' }))

    expect(await screen.findByText('175.00 SEK')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lists/list-1/items/item-1/decrement',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
        }),
      )
    })
  })

  it('reloads the list when another client update arrives over websocket', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Bröd',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              claimedAt: null,
              claimedByDisplayName: null,
              lastModifiedByDisplayName: 'olle',
              createdAt: '2026-03-26T18:06:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/checklista']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()
    expect(mockSockets).toHaveLength(1)

    mockSockets[0].emitMessage({
      eventType: 'shopping-list-item.added',
      listId: 'list-1',
      itemId: 'item-1',
      actorDisplayName: 'olle',
      occurredAt: '2026-03-26T18:06:00Z',
    })

    expect(await screen.findByText('Bröd')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  it('falls back to polling when websocket is unavailable', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const intervals: Array<{ callback: () => void; delay: number }> = []
    vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler, delay?: number) => {
      intervals.push({ callback: handler as () => void, delay: Number(delay ?? 0) })
      return 1 as unknown as number
    })
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Smör',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              claimedAt: null,
              claimedByDisplayName: null,
              lastModifiedByDisplayName: 'olle',
              createdAt: '2026-03-26T18:06:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
          ],
          recentActivities: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    vi.stubGlobal('WebSocket', BrokenWebSocket)

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/checklista']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()
    const pollingCallback = intervals.findLast((interval) => interval.delay === 5_000)?.callback
    expect(pollingCallback).toBeDefined()

    await act(async () => {
      await pollingCallback?.()
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText('Smör')).toBeInTheDocument()
  })
})

class MockWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3

  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  readyState = MockWebSocket.OPEN
  readonly url: string

  constructor(url: string) {
    this.url = url
    mockSockets.push(this)
    queueMicrotask(() => {
      this.onopen?.(new Event('open'))
    })
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  emitMessage(payload: unknown) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(payload),
      }),
    )
  }
}

class BrokenWebSocket {
  constructor() {
    throw new Error('WebSocket unavailable')
  }
}
