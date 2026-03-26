import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../app/AppShell'

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
      manualNote: 'Till tårtan',
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
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a manual item and reloads the list detail', async () => {
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
          itemType: 'MANUAL',
          title: 'Födelsedagsljus',
          checked: false,
          checkedAt: null,
          checkedByDisplayName: null,
          lastModifiedByDisplayName: 'anna',
          createdAt: '2026-03-26T18:05:00Z',
          updatedAt: '2026-03-26T18:05:00Z',
          position: 1,
          manualNote: 'Till tårtan',
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

    render(
      <MemoryRouter initialEntries={['/anna/lists/list-1']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Veckohandling')).toBeInTheDocument()

    const inputs = screen.getAllByRole('textbox')
    await userEvent.type(inputs[1], 'Födelsedagsljus')
    await userEvent.type(inputs[2], 'Till tårtan')
    await userEvent.click(screen.getByRole('button', { name: 'Lägg till rad' }))

    expect(await screen.findByText('Födelsedagsljus')).toBeInTheDocument()
    expect(await screen.findByText(/Till tårtan/i)).toBeInTheDocument()

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
})
