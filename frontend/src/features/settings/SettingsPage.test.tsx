import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../app/AppShell'

describe('SettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads archived lists, history and error logs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          archivedLists: [
            {
              id: 'list-1',
              name: 'Veckohandling',
              status: 'ARCHIVED',
              itemCount: 6,
              checkedItemCount: 4,
              updatedAt: '2026-03-29T09:00:00Z',
              archivedAt: '2026-03-29T09:00:00Z',
              lastModifiedByDisplayName: 'anna',
            },
          ],
          recentActivities: {
            items: [
              {
                id: 'act-1',
                listId: 'list-1',
                listName: 'Veckohandling',
                itemId: null,
                eventType: 'shopping-list.archived',
                actorDisplayName: 'anna',
                occurredAt: '2026-03-29T09:00:00Z',
              },
            ],
            page: 1,
            pageSize: 2,
            totalItems: 1,
            hasNextPage: false,
          },
          errorLogs: {
            items: [
              {
                id: 'err-1',
                level: 'WARN',
                source: 'BACKEND_API',
                code: 'INVALID_REQUEST',
                message: 'Unsupported stats range: fel',
                path: '/api/lists/stats',
                httpMethod: 'GET',
                actorDisplayName: 'anna',
                detailsJson: '{\"status\":400}',
                occurredAt: '2026-03-29T09:10:00Z',
              },
            ],
            page: 1,
            pageSize: 2,
            totalItems: 1,
            hasNextPage: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/installningar']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Drift, historik och arkiv' })).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/settings?activityPage=1&errorPage=1&activityPageSize=2&errorPageSize=2',
      expect.any(Object),
    )
    expect(screen.getAllByText('Veckohandling')).toHaveLength(2)
    expect(screen.getByText('Anna arkiverade en lista')).toBeInTheDocument()
    expect(screen.getByText('Unsupported stats range: fel')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inställningar' })).toHaveAttribute('href', '/anna/installningar')
  })

  it('lets the user change page size independently for history and errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          archivedLists: [],
          recentActivities: {
            items: [],
            page: 1,
            pageSize: 2,
            totalItems: 0,
            hasNextPage: false,
          },
          errorLogs: {
            items: [],
            page: 1,
            pageSize: 2,
            totalItems: 0,
            hasNextPage: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          archivedLists: [],
          recentActivities: {
            items: [],
            page: 1,
            pageSize: 10,
            totalItems: 0,
            hasNextPage: false,
          },
          errorLogs: {
            items: [],
            page: 1,
            pageSize: 2,
            totalItems: 0,
            hasNextPage: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(
      <MemoryRouter initialEntries={['/anna/installningar']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('combobox', { name: 'Aktiviteter per sida' })).toHaveValue('2')
    expect(screen.getByRole('combobox', { name: 'Fel per sida' })).toHaveValue('2')

    fireEvent.change(screen.getByRole('combobox', { name: 'Aktiviteter per sida' }), { target: { value: '10' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings?activityPage=1&errorPage=1&activityPageSize=10&errorPageSize=2',
        expect.any(Object),
      )
    })
  })
})
