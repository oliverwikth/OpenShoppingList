import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../app/AppShell'

describe('SettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports all lists as a single backup json', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const createObjectURL = vi.fn(() => 'blob:test-backup')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            archivedLists: [],
            recentActivities: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
            errorLogs: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            format: 'open-shopping-list-backup',
            version: 1,
            exportedAt: '2026-03-29T11:10:00Z',
            lists: [{ id: 'list-1', name: 'Veckohandling', status: 'ACTIVE', createdAt: '2026-03-29T10:00:00Z', updatedAt: '2026-03-29T10:00:00Z', archivedAt: null, lastModifiedByDisplayName: 'anna', items: [] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    render(
      <MemoryRouter initialEntries={['/anna/installningar']}>
        <AppShell />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Exportera JSON' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/backup', expect.any(Object))
    })
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-backup')
    expect(clickSpy).toHaveBeenCalled()
    expect(await screen.findByText('Exporterade 1 listor till JSON.')).toBeInTheDocument()
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
                detailsJson: '{"status":400}',
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

  it('imports a backup json and reloads settings', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            archivedLists: [],
            recentActivities: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
            errorLogs: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            importedLists: 1,
            importedItems: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            archivedLists: [],
            recentActivities: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
            errorLogs: { items: [], page: 1, pageSize: 2, totalItems: 0, hasNextPage: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    render(
      <MemoryRouter initialEntries={['/anna/installningar']}>
        <AppShell />
      </MemoryRouter>,
    )

    await screen.findByRole('button', { name: 'Importera JSON' })
    fireEvent.click(screen.getByRole('button', { name: 'Importera JSON' }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(
      [
        JSON.stringify({
          format: 'open-shopping-list-backup',
          version: 1,
          exportedAt: '2026-03-29T11:10:00Z',
          lists: [],
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    )
    Object.defineProperty(file, 'text', {
      value: () =>
        Promise.resolve(
          JSON.stringify({
            format: 'open-shopping-list-backup',
            version: 1,
            exportedAt: '2026-03-29T11:10:00Z',
            lists: [],
          }),
        ),
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings/backup/import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            format: 'open-shopping-list-backup',
            version: 1,
            exportedAt: '2026-03-29T11:10:00Z',
            lists: [],
          }),
        }),
      )
    })
    expect(await screen.findByText('Importerade 1 listor och 2 rader.')).toBeInTheDocument()
  })
})
