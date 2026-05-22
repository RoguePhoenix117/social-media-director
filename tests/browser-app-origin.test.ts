import { describe, expect, it } from 'vitest'
import {
  buildProviderCallbackUrls,
  originFromUrl,
  resolveProviderCallbackUrl,
} from '../app/lib/browser-app-origin'

describe('browser app origin helpers', () => {
  it('builds provider callback paths from an origin', () => {
    expect(buildProviderCallbackUrls('http://127.0.0.1:5174')).toEqual({
      x: 'http://127.0.0.1:5174/integrations/social/x/callback',
      linkedin: 'http://127.0.0.1:5174/integrations/social/linkedin/callback',
    })
  })

  it('prefers the browser origin when resolving callback URLs', () => {
    expect(
      resolveProviderCallbackUrl(
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5173/integrations/social/x/callback',
        'x',
      ),
    ).toBe('http://127.0.0.1:5174/integrations/social/x/callback')
  })

  it('falls back to the server callback URL without a browser origin', () => {
    expect(
      resolveProviderCallbackUrl(
        null,
        'http://127.0.0.1:5173/integrations/social/x/callback',
        'x',
      ),
    ).toBe('http://127.0.0.1:5173/integrations/social/x/callback')
  })

  it('extracts an origin from a callback URL', () => {
    expect(originFromUrl('http://127.0.0.1:5174/integrations/social/x/callback')).toBe(
      'http://127.0.0.1:5174',
    )
  })
})
