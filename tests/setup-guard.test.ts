import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertSetupKeyValid,
  isLocalhostOrigin,
  isSetupKeyConfigured,
} from '../app/lib/server/setup-guard'

const originalSetupKey = process.env.INSTANCE_SETUP_KEY

describe('isLocalhostOrigin', () => {
  it.each([
    ['http://localhost:5173', true],
    ['http://127.0.0.1:8080', true],
    ['http://0.0.0.0', true],
    ['http://[::1]:5173', true],
    ['https://app.example.com', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('returns %s for %s', (origin, expected) => {
    expect(isLocalhostOrigin(origin)).toBe(expected)
  })

  it('returns false when the origin is not a valid URL', () => {
    expect(isLocalhostOrigin('not-a-url')).toBe(false)
  })
})

describe('isSetupKeyConfigured', () => {
  beforeEach(() => {
    delete process.env.INSTANCE_SETUP_KEY
  })

  afterEach(() => {
    if (originalSetupKey === undefined) {
      delete process.env.INSTANCE_SETUP_KEY
    } else {
      process.env.INSTANCE_SETUP_KEY = originalSetupKey
    }
  })

  it('is false when the env var is unset', () => {
    expect(isSetupKeyConfigured()).toBe(false)
  })

  it('is false when the env var is whitespace only', () => {
    process.env.INSTANCE_SETUP_KEY = '   '
    expect(isSetupKeyConfigured()).toBe(false)
  })

  it('is true when the env var has a value', () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    expect(isSetupKeyConfigured()).toBe(true)
  })
})

describe('assertSetupKeyValid', () => {
  beforeEach(() => {
    delete process.env.INSTANCE_SETUP_KEY
  })

  afterEach(() => {
    if (originalSetupKey === undefined) {
      delete process.env.INSTANCE_SETUP_KEY
    } else {
      process.env.INSTANCE_SETUP_KEY = originalSetupKey
    }
  })

  it('skips the check on localhost even when the key is configured', () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    expect(() =>
      assertSetupKeyValid({ origin: 'http://localhost:5173', providedKey: undefined }),
    ).not.toThrow()
  })

  it('skips the check when no setup key is configured anywhere', () => {
    expect(() =>
      assertSetupKeyValid({ origin: 'https://app.example.com', providedKey: undefined }),
    ).not.toThrow()
  })

  it('throws when key is configured on public origin and none provided', () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    expect(() =>
      assertSetupKeyValid({ origin: 'https://app.example.com', providedKey: undefined }),
    ).toThrow(/INSTANCE_SETUP_KEY/)
  })

  it('throws when key is configured on public origin and an incorrect key is provided', () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    expect(() =>
      assertSetupKeyValid({ origin: 'https://app.example.com', providedKey: 'wrong' }),
    ).toThrow(/INSTANCE_SETUP_KEY/)
  })

  it('passes when key matches', () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    expect(
      assertSetupKeyValid({
        origin: 'https://app.example.com',
        providedKey: 'secret-123',
      }),
    ).toEqual({ required: true, valid: true })
  })
})
