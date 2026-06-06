import { describe, expect, it } from 'vitest'
import {
  isBrowserHotlinkRiskyImageUrl,
  sanitizePreviewImageUrl,
} from '../app/lib/import/preview-image'

describe('preview-image', () => {
  it('flags GitHub opengraph hosts as hotlink risky', () => {
    expect(
      isBrowserHotlinkRiskyImageUrl(
        'https://opengraph.githubassets.com/fd586cb7245a85adcfb29c175fd4838b0e527ab9139f225fa04448ff203af851/org/repo',
      ),
    ).toBe(true)
  })

  it('allows normal preview hosts', () => {
    expect(isBrowserHotlinkRiskyImageUrl('https://example.com/launch.png')).toBe(false)
  })

  it('strips risky URLs during sanitization', () => {
    expect(
      sanitizePreviewImageUrl(
        'https://opengraph.githubassets.com/fd586cb7245a85adcfb29c175fd4838b0e527ab9139f225fa04448ff203af851/org/repo',
      ),
    ).toBeUndefined()
    expect(sanitizePreviewImageUrl('https://example.com/launch.png')).toBe(
      'https://example.com/launch.png',
    )
  })
})
