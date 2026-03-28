import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../app/AppShell'

describe('ListsOverviewPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads shared lists for the actor route and creates a new list from the plus dialog with actor attribution', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: () => '26 mars 2026',
        } as Intl.DateTimeFormat
      } as unknown as typeof Intl.DateTimeFormat,
    )

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'list-1',
              name: 'Veckohandling',
              status: 'ACTIVE',
              itemCount: 2,
              checkedItemCount: 1,
              updatedAt: '2026-03-26T18:00:00Z',
              lastModifiedByDisplayName: 'anna',
            },
          ],
          page: 1,
          pageSize: 5,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'list-2',
          name: 'Helgmiddag',
          status: 'ACTIVE',
          itemCount: 0,
          checkedItemCount: 0,
          updatedAt: '2026-03-26T18:10:00Z',
          lastModifiedByDisplayName: 'anna',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'list-2',
          name: 'Helgmiddag',
          status: 'ACTIVE',
          createdAt: '2026-03-26T18:10:00Z',
          updatedAt: '2026-03-26T18:10:00Z',
          lastModifiedByDisplayName: 'anna',
          items: [],
          recentActivities: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Alla listor' })).toBeInTheDocument()
    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/lists?page=1&pageSize=5', expect.any(Object))

    fireEvent.click(screen.getByRole('button', { name: 'Skapa ny lista' }))

    const input = screen.getByLabelText('Listnamn')
    expect(input).toHaveValue('26 mars 2026')

    fireEvent.change(input, { target: { value: 'Helgmiddag' } })
    fireEvent.click(screen.getByRole('button', { name: 'Skapa lista' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lists',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Actor-Display-Name': 'anna',
          }),
        }),
      )
    })
  })

  it('loads more lists into the overview and lets the user switch page size up to all', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'list-6',
              name: 'Lista 6',
              status: 'ACTIVE',
              itemCount: 3,
              checkedItemCount: 1,
              updatedAt: '2026-03-26T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
          ],
          page: 1,
          pageSize: 5,
          totalItems: 6,
          totalPages: 2,
          hasPreviousPage: false,
          hasNextPage: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'list-1',
              name: 'Lista 1',
              status: 'ACTIVE',
              itemCount: 2,
              checkedItemCount: 0,
              updatedAt: '2026-03-20T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
          ],
          page: 2,
          pageSize: 5,
          totalItems: 6,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'list-6',
              name: 'Lista 6',
              status: 'ACTIVE',
              itemCount: 3,
              checkedItemCount: 1,
              updatedAt: '2026-03-26T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
            {
              id: 'list-5',
              name: 'Lista 5',
              status: 'ACTIVE',
              itemCount: 4,
              checkedItemCount: 2,
              updatedAt: '2026-03-25T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
            {
              id: 'list-4',
              name: 'Lista 4',
              status: 'ACTIVE',
              itemCount: 5,
              checkedItemCount: 3,
              updatedAt: '2026-03-24T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
            {
              id: 'list-3',
              name: 'Lista 3',
              status: 'ACTIVE',
              itemCount: 6,
              checkedItemCount: 4,
              updatedAt: '2026-03-23T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
            {
              id: 'list-2',
              name: 'Lista 2',
              status: 'ACTIVE',
              itemCount: 7,
              checkedItemCount: 5,
              updatedAt: '2026-03-22T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
            {
              id: 'list-1',
              name: 'Lista 1',
              status: 'ACTIVE',
              itemCount: 2,
              checkedItemCount: 0,
              updatedAt: '2026-03-20T18:10:00Z',
              lastModifiedByDisplayName: 'anna',
            },
          ],
          page: 1,
          pageSize: 6,
          totalItems: 6,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Lista 6')).toBeInTheDocument()
    expect(screen.getByText('Visar 1 av 6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Visa fler' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lists?page=2&pageSize=5', expect.any(Object))
    })
    expect(await screen.findByText('Lista 1')).toBeInTheDocument()
    expect(screen.getByText('Visar 2 av 6')).toBeInTheDocument()
    expect(screen.getByText('Lista 6')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Listor per sida'), { target: { value: 'all' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lists?page=1&pageSize=all', expect.any(Object))
    })
    expect(await screen.findByText('Visar 6 av 6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visa fler' })).not.toBeInTheDocument()
  })

  it('loads the statistics page and lets the user switch ranges', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          range: 'month',
          rangeStart: '2026-03-01T00:00:00Z',
          rangeEnd: '2026-03-28T12:00:00Z',
          currentPeriodLabel: 'mars 2026',
          previousPeriodLabel: 'februari 2026',
          spentAmount: 1499,
          previousSpentAmount: 980,
          currency: 'SEK',
          purchasedQuantity: 24,
          previousPurchasedQuantity: 18,
          activeListCount: 3,
          previousActiveListCount: 2,
          averagePricedItemAmount: 62.46,
          previousAveragePricedItemAmount: 54.44,
          spendSeries: [
            { label: '1', bucketStart: '2026-03-01T00:00:00Z', amount: 800, cumulativeAmount: 800, quantity: 8 },
            { label: '8', bucketStart: '2026-03-08T00:00:00Z', amount: 0, cumulativeAmount: 800, quantity: 0 },
            { label: '15', bucketStart: '2026-03-15T00:00:00Z', amount: 200, cumulativeAmount: 1000, quantity: 7 },
            { label: '22', bucketStart: '2026-03-22T00:00:00Z', amount: 0, cumulativeAmount: 1000, quantity: 0 },
            { label: '28', bucketStart: '2026-03-28T00:00:00Z', amount: 499, cumulativeAmount: 1499, quantity: 9 },
          ],
          topItems: [
            { title: 'Tortillabröd', quantity: 5, spentAmount: 210, imageUrl: 'https://example.com/tortilla.jpg' },
            { title: 'Kaffe', quantity: 4, spentAmount: 340, imageUrl: null },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          range: 'year',
          rangeStart: '2026-01-01T00:00:00Z',
          rangeEnd: '2026-03-28T12:00:00Z',
          currentPeriodLabel: '2026',
          previousPeriodLabel: '2025',
          spentAmount: 3999,
          previousSpentAmount: 2800,
          currency: 'SEK',
          purchasedQuantity: 81,
          previousPurchasedQuantity: 60,
          activeListCount: 8,
          previousActiveListCount: 6,
          averagePricedItemAmount: 49.37,
          previousAveragePricedItemAmount: 46.67,
          spendSeries: [
            { label: 'jan.', bucketStart: '2026-01-01T00:00:00Z', amount: 1200, cumulativeAmount: 1200, quantity: 22 },
            { label: 'feb.', bucketStart: '2026-02-01T00:00:00Z', amount: 1300, cumulativeAmount: 2500, quantity: 27 },
            { label: 'mars', bucketStart: '2026-03-01T00:00:00Z', amount: 1499, cumulativeAmount: 3999, quantity: 32 },
          ],
          topItems: [
            { title: 'Kaffe', quantity: 12, spentAmount: 999, imageUrl: null },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { container } = render(
      <MemoryRouter initialEntries={['/anna/statistik']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Din shopping i siffror')).toBeInTheDocument()
    expect(screen.getByText('Tortillabröd')).toBeInTheDocument()
    expect(container.querySelector('img[src="https://example.com/tortilla.jpg"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Alla listor' })).toHaveAttribute('href', '/anna')
    expect(container.querySelector('.stats-hero-chart')).toHaveAttribute('aria-label', 'Kostnad per period')
    expect(screen.getByRole('tab', { name: '1 mån' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '3 mån' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'i år' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '1 år' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All time' })).toBeInTheDocument()
    expect(screen.getByText('Tryck på grafen för värden')).toBeInTheDocument()

    const monthLinePath = container.querySelector('.stats-chart__line')?.getAttribute('d')
    expect(monthLinePath).toContain('M 16.00 18.00')
    expect(monthLinePath).toContain('L 159.00 180.00')
    expect(monthLinePath).toContain('L 302.00 99.27')
    expect(monthLinePath).not.toContain('87.50 234.00')
    expect(monthLinePath).not.toContain('230.50 234.00')

    expect(screen.getByRole('button', { name: /Visa 1 mars 2026: 800/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Visa 15 mars 2026: 200/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Visa 28 mars 2026: 499/ })).toBeInTheDocument()
    expect(container.querySelector('.stats-chart-tooltip')?.textContent).toContain('499')
    expect(container.querySelector('.stats-chart-tooltip')?.textContent).toContain('9 varor')

    fireEvent.click(screen.getByRole('tab', { name: '1 år' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lists/stats?range=year', expect.any(Object))
    })

    await waitFor(() => {
      expect(screen.getByText(/3.*999.*kr/)).toBeInTheDocument()
    })
    expect(screen.getByText('Kaffe')).toBeInTheDocument()
  })
})
