import { afterEach, describe, expect, it, vi } from 'vitest'
import { xAdapter } from '../app/lib/providers/x'

describe('xAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('publishes through the official X create post endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '123', text: 'Hello' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const result = await xAdapter.publish({ text: 'Hello' }, 'token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.com/2/tweets',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.providerPostId).toBe('123')
    expect(result.providerPostUrl).toBe('https://x.com/i/web/status/123')
  })
})
