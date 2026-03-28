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

  it('sorts the varor tab by created time instead of updated time', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'MANUAL',
              title: 'Nyare vara',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:06:00Z',
              updatedAt: '2026-03-26T18:10:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: null,
            },
            {
              id: 'item-2',
              itemType: 'MANUAL',
              title: 'Äldre vara',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:09:00Z',
              position: 2,
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

    const { container } = render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Nyare vara')).toBeInTheDocument()
    expect(screen.getByText('Äldre vara')).toBeInTheDocument()

    const content = container.textContent ?? ''
    expect(content.indexOf('Äldre vara')).toBeLessThan(content.indexOf('Nyare vara'))
  })

  it('debounces manual search adds after the last change', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    let listFetchCount = 0

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        listFetchCount += 1
        return new Response(JSON.stringify(listFetchCount === 1 ? initialList : {
          ...updatedList,
          items: [
            {
              ...updatedList.items[0],
              quantity: 3,
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.startsWith('/api/retailer-search?q=F%C3%B6delsedagsljus&page=0')) {
        return new Response(
          JSON.stringify(createSearchResponse('Födelsedagsljus', [], { totalPages: 0, totalResults: 0 })),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url === '/api/lists/list-1/items/manual') {
        return new Response(
          JSON.stringify({
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
            quantity: 3,
            manualNote: '',
            externalSnapshot: null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Sök artikel'), 'Födelsedagsljus')
    await userEvent.click(screen.getByRole('button', { name: 'Lägg till Födelsedagsljus' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Födelsedagsljus' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Födelsedagsljus' }))

    expect(screen.getByRole('group', { name: 'Antal för Födelsedagsljus' })).toHaveTextContent('3')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/manual')).toHaveLength(0)

    await waitFor(
      () => {
      const manualPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/manual')
      expect(manualPosts).toHaveLength(1)
      expect(manualPosts[0][1]).toEqual(
        expect.objectContaining({
          body: JSON.stringify({
            title: 'Födelsedagsljus',
            note: '',
            quantity: 3,
          }),
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
          method: 'POST',
        }),
      )
      },
      { timeout: 1_500 },
    )
  })

  it('debounces repeated retailer result adds into one request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    let listFetchCount = 0

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        listFetchCount += 1
        return new Response(JSON.stringify(listFetchCount === 1 ? initialList : {
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Kaffe 1',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:00Z',
              position: 1,
              quantity: 5,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: '1',
                subtitle: '500g',
                imageUrl: null,
                category: 'Dryck',
                priceAmount: 39.9,
                currency: 'SEK',
              },
            },
          ],
          recentActivities: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.startsWith('/api/retailer-search?q=kaffe&page=0')) {
        return new Response(
          JSON.stringify(createSearchResponse('kaffe', [createRetailerResult('1', 'Kaffe 1')], { totalPages: 1, totalResults: 1 })),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url === '/api/lists/list-1/items/external') {
        return new Response(
          JSON.stringify({
            id: 'item-1',
            itemType: 'EXTERNAL_ARTICLE',
            title: 'Kaffe 1',
            checked: false,
            checkedAt: null,
            checkedByDisplayName: null,
            lastModifiedByDisplayName: 'anna',
            createdAt: '2026-03-26T18:05:00Z',
            updatedAt: '2026-03-26T18:05:00Z',
            position: 1,
            quantity: 5,
            manualNote: '',
            externalSnapshot: {
              provider: 'willys',
              articleId: '1',
              subtitle: '500g',
              imageUrl: null,
              category: 'Dryck',
              priceAmount: 39.9,
              currency: 'SEK',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Sök artikel'), 'kaffe')
    await userEvent.click(await screen.findByRole('button', { name: 'Lägg till Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))

    expect(screen.getByRole('group', { name: 'Antal för Kaffe 1' })).toHaveTextContent('5')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/external')).toHaveLength(0)

    await waitFor(
      () => {
      const externalPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/external')
      expect(externalPosts).toHaveLength(1)
      expect(externalPosts[0][1]).toEqual(
        expect.objectContaining({
          body: JSON.stringify({
            provider: 'willys',
            articleId: '1',
            title: 'Kaffe 1',
            subtitle: '500g',
            imageUrl: null,
            category: 'Dryck',
            priceAmount: 39.9,
            currency: 'SEK',
            rawPayloadJson: '{}',
            quantity: 5,
          }),
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
          method: 'POST',
        }),
      )
      },
      { timeout: 1_500 },
    )
  })

  it('debounces multiple different retailer items from the same search', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    let listFetchCount = 0

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        listFetchCount += 1
        return new Response(JSON.stringify(listFetchCount === 1 ? initialList : {
          ...initialList,
          items: [
            {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Taco Bröd',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:05:00Z',
              position: 1,
              quantity: 1,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: 'taco-1',
                subtitle: '8-pack',
                imageUrl: null,
                category: 'Taco',
                priceAmount: 29.9,
                currency: 'SEK',
              },
            },
            {
              id: 'item-2',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Taco Färs',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:10Z',
              updatedAt: '2026-03-26T18:05:10Z',
              position: 2,
              quantity: 1,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: 'taco-2',
                subtitle: '400g',
                imageUrl: null,
                category: 'Taco',
                priceAmount: 59.9,
                currency: 'SEK',
              },
            },
          ],
          recentActivities: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.startsWith('/api/retailer-search?q=taco&page=0')) {
        return new Response(
          JSON.stringify(
            createSearchResponse('taco', [
              {
                ...createRetailerResult('taco-1', 'Taco Bröd'),
                subtitle: '8-pack',
                category: 'Taco',
                priceAmount: 29.9,
              },
              {
                ...createRetailerResult('taco-2', 'Taco Färs'),
                subtitle: '400g',
                category: 'Taco',
                priceAmount: 59.9,
              },
            ], { totalPages: 1, totalResults: 2 }),
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url === '/api/lists/list-1/items/external') {
        const body = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            id: body.articleId === 'taco-1' ? 'item-1' : 'item-2',
            itemType: 'EXTERNAL_ARTICLE',
            title: body.title,
            checked: false,
            checkedAt: null,
            checkedByDisplayName: null,
            lastModifiedByDisplayName: 'anna',
            createdAt: body.articleId === 'taco-1' ? '2026-03-26T18:05:00Z' : '2026-03-26T18:05:10Z',
            updatedAt: body.articleId === 'taco-1' ? '2026-03-26T18:05:00Z' : '2026-03-26T18:05:10Z',
            position: body.articleId === 'taco-1' ? 1 : 2,
            quantity: body.quantity,
            manualNote: '',
            externalSnapshot: {
              provider: body.provider,
              articleId: body.articleId,
              subtitle: body.subtitle,
              imageUrl: body.imageUrl,
              category: body.category,
              priceAmount: body.priceAmount,
              currency: body.currency,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Sök artikel'), 'taco')
    await userEvent.click(await screen.findByRole('button', { name: 'Lägg till Taco Bröd' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Lägg till Taco Färs' }))

    await waitFor(
      () => {
      const externalPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/external')
      expect(externalPosts).toHaveLength(2)
      expect(externalPosts.map(([, init]) => JSON.parse(String(init?.body)).articleId)).toEqual(['taco-1', 'taco-2'])
      },
      { timeout: 1_500 },
    )
  })

  it('batches repeated retailer search taps for an existing item into one quantity-adjust request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            ...initialList,
            items: [
              {
                id: 'item-1',
                itemType: 'EXTERNAL_ARTICLE',
                title: 'Kaffe 1',
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
                  articleId: '1',
                  subtitle: '500g',
                  imageUrl: null,
                  category: 'Dryck',
                  priceAmount: 39.9,
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
        )
      }

      if (url.startsWith('/api/retailer-search?q=kaffe&page=0')) {
        return new Response(
          JSON.stringify(createSearchResponse('kaffe', [createRetailerResult('1', 'Kaffe 1')], { totalPages: 1, totalResults: 1 })),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url === '/api/lists/list-1/items/item-1/quantity-adjust') {
        const body = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            itemId: 'item-1',
            removed: false,
            item: {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Kaffe 1',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 2 + body.delta,
              manualNote: '',
              externalSnapshot: {
                provider: 'willys',
                articleId: '1',
                subtitle: '500g',
                imageUrl: null,
                category: 'Dryck',
                priceAmount: 39.9,
                currency: 'SEK',
              },
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Sök artikel'), 'kaffe')
    await userEvent.click(await screen.findByRole('button', { name: 'Öka Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Öka Kaffe 1' }))

    expect(screen.getByRole('group', { name: 'Antal för Kaffe 1' })).toHaveTextContent('5')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/external')).toHaveLength(0)

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/lists/list-1/items/item-1/quantity-adjust',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              delta: 3,
            }),
            headers: expect.objectContaining({
              'X-Actor-Display-Name': 'anna',
            }),
          }),
        )
      },
      { timeout: 1_500 },
    )
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

  it('focuses the search input immediately when opening search from varor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Öppna sök' }))

    expect(await screen.findByLabelText('Sök artikel')).toHaveFocus()
  })

  it('clears the search input from the clear button', async () => {
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

    const searchInput = await screen.findByLabelText('Sök artikel')

    await userEvent.type(searchInput, 'kaffe')
    await userEvent.click(screen.getByRole('button', { name: 'Rensa sökning' }))

    expect(searchInput).toHaveValue('')
  })

  it('appends the next search page instead of replacing the first results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(initialList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(createSearchResponse('kaffe', [createRetailerResult('1', 'Kaffe 1')], { totalPages: 3, totalResults: 3 })),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          createSearchResponse('kaffe', [createRetailerResult('2', 'Kaffe 2')], {
            currentPage: 1,
            totalPages: 3,
            totalResults: 3,
          }),
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor/search?q=kaffe']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Kaffe 1')).toBeInTheDocument()
    expect(screen.queryByText('Kaffe 2')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Visa fler träffar' }))

    expect(await screen.findByText('Kaffe 1')).toBeInTheDocument()
    expect(await screen.findByText('Kaffe 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '←' })).toHaveAttribute('href', '/anna/lists/list-1/varor/search?q=kaffe')
    expect(fetchMock).toHaveBeenCalledWith('/api/retailer-search?q=kaffe&page=1', expect.any(Object))
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

    expect(await screen.findByText('Anna hämtar')).toBeInTheDocument()

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

  it('batches repeated varor taps into a single quantity-adjust request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        return new Response(
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
        )
      }

      if (url === '/api/lists/list-1/items/item-1/quantity-adjust') {
        const body = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            itemId: 'item-1',
            removed: false,
            item: {
              id: 'item-1',
              itemType: 'EXTERNAL_ARTICLE',
              title: 'Kaffe',
              checked: false,
              checkedAt: null,
              checkedByDisplayName: null,
              lastModifiedByDisplayName: 'anna',
              createdAt: '2026-03-26T18:05:00Z',
              updatedAt: '2026-03-26T18:06:00Z',
              position: 1,
              quantity: 2 + body.delta,
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
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Kaffe')).toBeInTheDocument()
    expect(screen.getByText('175.00 SEK')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Öka Kaffe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Öka Kaffe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Öka Kaffe' }))

    expect(screen.getByRole('group', { name: 'Antal för Kaffe' })).toHaveTextContent('5')
    expect(screen.getByText('437.50 SEK')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/item-1/quantity-adjust')).toHaveLength(0)

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/lists/list-1/items/item-1/quantity-adjust',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              delta: 3,
            }),
            headers: expect.objectContaining({
              'X-Actor-Display-Name': 'anna',
            }),
          }),
        )
      },
      { timeout: 1_500 },
    )
  })

  it('does not post a varor quantity-adjust request when the net delta returns to zero', async () => {
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

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/varor']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Kaffe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Öka Kaffe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Minska Kaffe' }))

    expect(screen.getByRole('group', { name: 'Antal för Kaffe' })).toHaveTextContent('2')
    expect(screen.getByText('175.00 SEK')).toBeInTheDocument()

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700))
    })

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/lists/list-1/items/item-1/quantity-adjust')).toHaveLength(0)
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

  it('keeps a locally checked item checked when a stale websocket reload resolves afterward', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    let listFetchCount = 0
    let resolveCheckRequest: ((value: Response) => void) | null = null
    let resolveRealtimeReload: ((value: Response) => void) | null = null

    fetchMock.mockImplementation((input, init) => {
      const url = String(input)

      if (url === '/api/lists/list-1' && (!init?.method || init.method === 'GET')) {
        listFetchCount += 1

        if (listFetchCount === 1) {
          return Promise.resolve(
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
        }

        return new Promise((resolve) => {
          resolveRealtimeReload = resolve
        })
      }

      if (url === '/api/lists/list-1/items/item-1/check') {
        return new Promise((resolve) => {
          resolveCheckRequest = resolve
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1/checklista']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Tomater')).toBeInTheDocument()
    expect(mockSockets).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Markera Tomater' }))

    mockSockets[0].emitMessage({
      eventType: 'shopping-list-item.checked',
      listId: 'list-1',
      itemId: 'item-1',
      actorDisplayName: 'anna',
      occurredAt: '2026-03-26T18:06:00Z',
    })

    await waitFor(() => {
      expect(listFetchCount).toBe(2)
      expect(resolveCheckRequest).not.toBeNull()
      expect(resolveRealtimeReload).not.toBeNull()
    })

    await act(async () => {
      resolveCheckRequest?.(
        new Response(
          JSON.stringify({
            id: 'item-1',
            itemType: 'MANUAL',
            title: 'Tomater',
            checked: true,
            checkedAt: '2026-03-26T18:06:00Z',
            checkedByDisplayName: 'anna',
            claimedAt: null,
            claimedByDisplayName: null,
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
      await Promise.resolve()
    })

    expect(await screen.findByRole('button', { name: 'Avmarkera Tomater' })).toBeInTheDocument()

    await act(async () => {
      resolveRealtimeReload?.(
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
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Avmarkera Tomater' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Markera Tomater' })).not.toBeInTheDocument()
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

function createRetailerResult(articleId: string, title: string) {
  return {
    provider: 'willys',
    articleId,
    title,
    subtitle: '500g',
    imageUrl: null,
    category: 'Dryck',
    priceAmount: 39.9,
    currency: 'SEK',
    rawPayloadJson: '{}',
  }
}

function createSearchResponse(
  query: string,
  results: ReturnType<typeof createRetailerResult>[],
  overrides: Partial<{
    currentPage: number
    totalPages: number
    totalResults: number
    hasMoreResults: boolean
    available: boolean
    message: string | null
  }> = {},
) {
  const currentPage = overrides.currentPage ?? 0
  const totalPages = overrides.totalPages ?? 1
  return {
    provider: 'willys',
    query,
    currentPage,
    totalPages,
    totalResults: overrides.totalResults ?? results.length,
    hasMoreResults: overrides.hasMoreResults ?? currentPage + 1 < totalPages,
    available: overrides.available ?? true,
    message: overrides.message ?? null,
    results,
  }
}

class BrokenWebSocket {
  constructor() {
    throw new Error('WebSocket unavailable')
  }
}
