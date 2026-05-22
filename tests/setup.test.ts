import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const originalSetupKey = process.env.INSTANCE_SETUP_KEY

describe('buildSaveInput', () => {
  it('accepts all provider fields when starting from empty config', async () => {
    const { buildSaveInput } = await import('../app/lib/server/setup-helpers')

    const result = buildSaveInput(
      { x: null, linkedin: null },
      {
        xClientId: 'new-x',
        xClientSecret: 'new-x-secret',
        linkedinClientId: 'new-li',
        linkedinClientSecret: 'new-li-secret',
      },
    )

    expect(result).toEqual({
      xClientId: 'new-x',
      xClientSecret: 'new-x-secret',
      linkedinClientId: 'new-li',
      linkedinClientSecret: 'new-li-secret',
    })
  })

  it('ignores undefined fields entirely (does not blank them out)', async () => {
    const { buildSaveInput } = await import('../app/lib/server/setup-helpers')

    const result = buildSaveInput(
      {
        x: { clientId: 'env-x', clientSecret: 'env-x-secret', source: 'env' },
        linkedin: null,
      },
      { xClientId: 'updated-x' },
    )

    expect(result).toEqual({ xClientId: 'updated-x' })
  })

  it('drops blank secrets so existing .env values are preserved', async () => {
    const { buildSaveInput } = await import('../app/lib/server/setup-helpers')

    const result = buildSaveInput(
      {
        x: { clientId: 'env-x', clientSecret: 'env-x-secret', source: 'env' },
        linkedin: null,
      },
      { xClientId: 'updated-x', xClientSecret: '   ' },
    )

    expect(result).toEqual({ xClientId: 'updated-x' })
  })
})

describe('toProviderStatus', () => {
  it('returns null state for missing config', async () => {
    const { toProviderStatus } = await import('../app/lib/server/setup-helpers')
    expect(toProviderStatus(null)).toEqual({
      clientId: null,
      clientSecretConfigured: false,
      source: 'none',
    })
  })

  it('hides the secret value, exposing only configured flag + clientId + source', async () => {
    const { toProviderStatus } = await import('../app/lib/server/setup-helpers')
    expect(
      toProviderStatus({ clientId: 'x-id', clientSecret: 'x-secret', source: 'env' }),
    ).toEqual({
      clientId: 'x-id',
      clientSecretConfigured: true,
      source: 'env',
    })
  })
})

describe('buildCallbackUrls', () => {
  it('joins the origin with the canonical provider callback paths', async () => {
    const { buildCallbackUrls } = await import('../app/lib/server/setup-helpers')
    expect(buildCallbackUrls('https://app.example.com')).toEqual({
      x: 'https://app.example.com/integrations/social/x/callback',
      linkedin: 'https://app.example.com/integrations/social/linkedin/callback',
    })
  })

  it('uses 127.0.0.1 instead of localhost for local dev', async () => {
    const { buildCallbackUrls } = await import('../app/lib/server/setup-helpers')
    expect(buildCallbackUrls('http://localhost:5174')).toEqual({
      x: 'http://127.0.0.1:5174/integrations/social/x/callback',
      linkedin: 'http://127.0.0.1:5174/integrations/social/linkedin/callback',
    })
  })
})

describe('computeSetupKeyState', () => {
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

  it('is not required and is valid when on localhost', async () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    const { computeSetupKeyState } = await import('../app/lib/server/setup-helpers')
    expect(
      computeSetupKeyState({ origin: 'http://localhost:5173', providedKey: undefined }),
    ).toEqual({ required: false, valid: true, configured: true })
  })

  it('is not required and is valid when no key configured', async () => {
    const { computeSetupKeyState } = await import('../app/lib/server/setup-helpers')
    expect(
      computeSetupKeyState({ origin: 'https://app.example.com', providedKey: undefined }),
    ).toEqual({ required: false, valid: true, configured: false })
  })

  it('reports required + invalid when no key provided on public host', async () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    const { computeSetupKeyState } = await import('../app/lib/server/setup-helpers')
    expect(
      computeSetupKeyState({ origin: 'https://app.example.com', providedKey: undefined }),
    ).toEqual({ required: true, valid: false, configured: true })
  })

  it('validates the provided key against env', async () => {
    process.env.INSTANCE_SETUP_KEY = 'secret-123'
    const { computeSetupKeyState } = await import('../app/lib/server/setup-helpers')
    expect(
      computeSetupKeyState({ origin: 'https://app.example.com', providedKey: 'secret-123' }),
    ).toEqual({ required: true, valid: true, configured: true })
    expect(
      computeSetupKeyState({ origin: 'https://app.example.com', providedKey: 'wrong' }),
    ).toEqual({ required: true, valid: false, configured: true })
  })
})
