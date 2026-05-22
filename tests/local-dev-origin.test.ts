import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_ORIGIN,
  normalizeLocalDevOrigin,
  normalizeLocalDevUrl,
  resolveAppOrigin,
} from '../app/lib/local-dev-origin'

describe('normalizeLocalDevOrigin', () => {
  it('replaces localhost with 127.0.0.1', () => {
    expect(normalizeLocalDevOrigin('http://localhost:5174')).toBe('http://127.0.0.1:5174')
    expect(normalizeLocalDevUrl('http://localhost:5174/integrations/social/x/callback')).toBe(
      'http://127.0.0.1:5174/integrations/social/x/callback',
    )
  })

  it('leaves 127.0.0.1 and production hosts unchanged', () => {
    expect(normalizeLocalDevOrigin('http://127.0.0.1:5174')).toBe('http://127.0.0.1:5174')
    expect(normalizeLocalDevOrigin('https://app.example.com')).toBe('https://app.example.com')
  })
})

describe('resolveAppOrigin', () => {
  it('prefers the live request origin over APP_ORIGIN for local dev', () => {
    const previous = process.env.APP_ORIGIN
    process.env.APP_ORIGIN = 'http://localhost:5173'
    expect(resolveAppOrigin('http://localhost:5174')).toBe('http://127.0.0.1:5174')
    if (previous === undefined) delete process.env.APP_ORIGIN
    else process.env.APP_ORIGIN = previous
  })

  it('uses APP_ORIGIN when no local request origin is available', () => {
    const previous = process.env.APP_ORIGIN
    process.env.APP_ORIGIN = 'http://localhost:5174'
    expect(resolveAppOrigin()).toBe('http://127.0.0.1:5174')
    if (previous === undefined) delete process.env.APP_ORIGIN
    else process.env.APP_ORIGIN = previous
  })

  it('uses APP_ORIGIN for non-local hosts when the request is also non-local', () => {
    const previous = process.env.APP_ORIGIN
    process.env.APP_ORIGIN = 'https://app.example.com'
    expect(resolveAppOrigin('https://app.example.com')).toBe('https://app.example.com')
    if (previous === undefined) delete process.env.APP_ORIGIN
    else process.env.APP_ORIGIN = previous
  })

  it('normalizes the request origin when APP_ORIGIN is unset', () => {
    const previous = process.env.APP_ORIGIN
    delete process.env.APP_ORIGIN
    expect(resolveAppOrigin('http://localhost:5174')).toBe('http://127.0.0.1:5174')
    if (previous === undefined) delete process.env.APP_ORIGIN
    else process.env.APP_ORIGIN = previous
  })

  it('falls back to the local default', () => {
    const previous = process.env.APP_ORIGIN
    delete process.env.APP_ORIGIN
    expect(resolveAppOrigin()).toBe(DEFAULT_LOCAL_ORIGIN)
    if (previous === undefined) delete process.env.APP_ORIGIN
    else process.env.APP_ORIGIN = previous
  })
})
