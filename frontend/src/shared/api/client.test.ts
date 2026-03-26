import { apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns undefined for successful empty responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiRequest<void>('/api/test', { method: 'POST' })).resolves.toBeUndefined()
  })
})
