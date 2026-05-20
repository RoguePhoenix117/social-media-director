import { afterEach, describe, expect, it, vi } from 'vitest'
import { logInfo } from '../app/lib/server/logger'

describe('server logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts secret-looking fields', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    logInfo('test.event', {
      apiKey: 'sk-secret',
      accessToken: 'token-secret',
      normalField: 'visible',
    })

    expect(log).toHaveBeenCalledOnce()
    const payload = JSON.parse(log.mock.calls[0]![0] as string) as {
      apiKey: string
      accessToken: string
      normalField: string
    }

    expect(payload.apiKey).toBe('[redacted]')
    expect(payload.accessToken).toBe('[redacted]')
    expect(payload.normalField).toBe('visible')
  })
})
