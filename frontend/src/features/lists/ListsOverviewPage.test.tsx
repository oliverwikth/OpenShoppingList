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
        JSON.stringify([
          {
            id: 'list-1',
            name: 'Veckohandling',
            status: 'ACTIVE',
            itemCount: 2,
            checkedItemCount: 1,
            updatedAt: '2026-03-26T18:00:00Z',
            lastModifiedByDisplayName: 'anna',
          },
        ]),
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
            { label: '1', bucketStart: '2026-03-01T00:00:00Z', amount: 499, cumulativeAmount: 499, quantity: 8 },
            { label: '15', bucketStart: '2026-03-15T00:00:00Z', amount: 500, cumulativeAmount: 999, quantity: 7 },
            { label: '28', bucketStart: '2026-03-28T00:00:00Z', amount: 500, cumulativeAmount: 1499, quantity: 9 },
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

    fireEvent.click(screen.getByRole('tab', { name: 'År' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lists/stats?range=year', expect.any(Object))
    })

    await waitFor(() => {
      expect(screen.getByText(/3.*999.*kr/)).toBeInTheDocument()
    })
    expect(screen.getByText('Kaffe')).toBeInTheDocument()
  })
})
