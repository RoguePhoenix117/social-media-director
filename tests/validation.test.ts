import { describe, expect, it } from 'vitest'
import { validateProviderPayload } from '../app/lib/domain/validation'

describe('validateProviderPayload', () => {
  it('rejects X posts over 280 characters', () => {
    const result = validateProviderPayload('x', {
      text: 'x'.repeat(281),
    })

    expect(result.status).toBe('invalid')
    expect(result.messages).toContain('X posts are limited to 280 characters.')
  })

  it('accepts LinkedIn posts with a valid source link', () => {
    const result = validateProviderPayload('linkedin', {
      text: 'Read our launch notes.',
      linkUrl: 'https://example.com/posts/launch',
    })

    expect(result).toEqual({ status: 'valid', messages: [] })
  })

  it('rejects non-http image URLs', () => {
    const result = validateProviderPayload('linkedin', {
      text: 'Read our launch notes.',
      imageUrl: 'file:///tmp/image.png',
    })

    expect(result.status).toBe('invalid')
    expect(result.messages).toContain('Image URL must be an absolute HTTP or HTTPS URL.')
  })
})
