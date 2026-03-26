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

    expect(await screen.findByText('Alla listor')).toBeInTheDocument()
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
})
