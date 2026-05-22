import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLinkedInAdapter } from '../app/lib/providers/linkedin'

/**
 * Smoke test for the LinkedIn publish adapter as wired by PR5: the publish
 * path constructs the adapter with `authorUrn` from
 * `provider_accounts.author_urn`, NOT from environment variables. This test
 * pins the wire format (REST `/rest/posts`, `Linkedin-Version` header,
 * `author = urn:li:person:...`) so future refactors stay safe.
 */

describe('createLinkedInAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('publishes through /rest/posts using the provided authorUrn and bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'x-restli-id': 'urn:li:share:abc123',
        },
      }),
    )

    const adapter = createLinkedInAdapter({ authorUrn: 'urn:li:person:abc123' })
    const result = await adapter.publish({ text: 'Hello LinkedIn' }, 'access-token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({ method: 'POST' }),
    )
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer access-token')
    expect(headers['Linkedin-Version']).toBeTruthy()
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.author).toBe('urn:li:person:abc123')
    expect(body.lifecycleState).toBe('PUBLISHED')
    expect(body.commentary).toBe('Hello LinkedIn')

    expect(result.providerPostId).toBe('urn:li:share:abc123')
    expect(result.providerPostUrl).toContain('https://www.linkedin.com/feed/update/')
  })
})
