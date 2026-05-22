import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for the X OAuth 2.0 PKCE primitives. These tests focus on:
 *  - PKCE state row creation with a valid S256 code challenge
 *  - One-shot validation of state tokens (replay prevention)
 *  - Authorize URL composition
 *  - Token exchange wire format (basic auth, x-www-form-urlencoded)
 *  - Profile fetch wire format
 *
 * The DB is mocked; we never touch a real database.
 */

type OAuthStateRow = {
  id: string
  operator_id: string
  project_id: string
  provider: 'x' | 'linkedin'
  state_token: string
  code_verifier: string
  redirect_after: string | null
  expires_at: string
}

const oauthStateRows = new Map<string, OAuthStateRow>()
let nextStateId = 1

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('insert into oauth_states')) {
        const id = `state-${nextStateId++}`
        const ttlSeconds = Number(params[6])
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
        const row: OAuthStateRow = {
          id,
          operator_id: params[0] as string,
          project_id: params[1] as string,
          provider: params[2] as 'x' | 'linkedin',
          state_token: params[3] as string,
          code_verifier: params[4] as string,
          redirect_after: (params[5] as string | null) ?? null,
          expires_at: expiresAt,
        }
        oauthStateRows.set(row.state_token, row)
        return { rows: [] }
      }

      if (sql.includes('delete from oauth_states') && sql.includes('where state_token = $1')) {
        const token = params[0] as string
        const row = oauthStateRows.get(token)
        if (!row) return { rows: [] }
        oauthStateRows.delete(token)
        return { rows: [row] }
      }

      if (sql.includes('delete from oauth_states') && sql.includes('expires_at <= now()')) {
        const now = Date.now()
        for (const [token, row] of oauthStateRows.entries()) {
          if (new Date(row.expires_at).getTime() <= now) {
            oauthStateRows.delete(token)
          }
        }
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    }),
  }),
}))

const ORIGINAL_ENV = { ...process.env }

function clearOAuthEnv() {
  delete process.env.X_CLIENT_ID
  delete process.env.X_CLIENT_SECRET
  delete process.env.LINKEDIN_CLIENT_ID
  delete process.env.LINKEDIN_CLIENT_SECRET
}

function restoreOAuthEnv() {
  process.env = { ...ORIGINAL_ENV }
}

describe('createOAuthState + consumeOAuthState', () => {
  beforeEach(() => {
    oauthStateRows.clear()
    nextStateId = 1
  })

  it('creates a state with a valid PKCE S256 challenge', async () => {
    const { createOAuthState } = await import('../app/lib/server/oauth/state')

    const result = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
    })

    expect(result.stateToken).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(result.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
    const expectedChallenge = base64url(
      crypto.createHash('sha256').update(result.codeVerifier).digest(),
    )
    expect(result.codeChallenge).toBe(expectedChallenge)
  })

  it('consumes a state row exactly once (replay rejected)', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
    })

    const first = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'x',
    })
    expect(first).toMatchObject({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
      codeVerifier: created.codeVerifier,
    })

    const second = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'x',
    })
    expect(second).toBeNull()
  })

  it('rejects state when the operator does not match', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
    })

    const result = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-2',
      expectedProvider: 'x',
    })

    expect(result).toBeNull()
  })

  it('rejects state when the provider does not match', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
    })

    const result = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'linkedin',
    })

    expect(result).toBeNull()
  })

  it('rejects state when expired', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'x',
    })
    const row = oauthStateRows.get(created.stateToken)!
    row.expires_at = new Date(Date.now() - 1000).toISOString()

    const result = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'x',
    })

    expect(result).toBeNull()
  })

  it('returns null for an unknown state token', async () => {
    const { consumeOAuthState } = await import('../app/lib/server/oauth/state')

    await expect(
      consumeOAuthState({
        stateToken: 'never-issued',
        expectedOperatorId: 'op-1',
        expectedProvider: 'x',
      }),
    ).resolves.toBeNull()
  })
})

describe('buildXAuthorizeUrl', () => {
  it('serializes all required PKCE parameters', async () => {
    const { buildXAuthorizeUrl, X_OAUTH_SCOPES } = await import('../app/lib/server/oauth/x')

    const url = buildXAuthorizeUrl({
      clientId: 'client-id',
      redirectUri: 'http://localhost:5173/integrations/social/x/callback',
      state: 'state-token',
      codeChallenge: 'challenge-token',
    })

    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://twitter.com/i/oauth2/authorize')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/integrations/social/x/callback',
    )
    expect(parsed.searchParams.get('scope')).toBe(X_OAUTH_SCOPES.join(' '))
    expect(parsed.searchParams.get('state')).toBe('state-token')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-token')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
  })
})

describe('exchangeXCode', () => {
  it('POSTs the token endpoint with PKCE verifier and HTTP basic auth', async () => {
    const { exchangeXCode } = await import('../app/lib/server/oauth/x')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 7200,
        scope: 'tweet.read tweet.write users.read offline.access',
        token_type: 'bearer',
      }),
    )

    const tokens = await exchangeXCode({
      code: 'auth-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://localhost:5173/integrations/social/x/callback',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0]!
    expect(calledUrl).toBe('https://api.twitter.com/2/oauth2/token')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded')
    const expectedAuth =
      'Basic ' + Buffer.from('client-id:client-secret').toString('base64')
    expect(headers.authorization).toBe(expectedAuth)
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBe('verifier')
    expect(body.get('redirect_uri')).toBe(
      'http://localhost:5173/integrations/social/x/callback',
    )
    expect(body.get('client_id')).toBe('client-id')

    expect(tokens.accessToken).toBe('access-token')
    expect(tokens.refreshToken).toBe('refresh-token')
    expect(tokens.expiresAt).toBeInstanceOf(Date)
    expect(tokens.scope).toContain('offline.access')
  })

  it('throws a useful message when the token endpoint returns an error', async () => {
    const { exchangeXCode } = await import('../app/lib/server/oauth/x')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({ error: 'invalid_grant', error_description: 'Code already used' }, 400),
    )

    await expect(
      exchangeXCode({
        code: 'auth-code',
        codeVerifier: 'verifier',
        redirectUri: 'http://localhost:5173/integrations/social/x/callback',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Code already used/)
  })
})

describe('refreshXToken', () => {
  it('POSTs grant_type=refresh_token', async () => {
    const { refreshXToken } = await import('../app/lib/server/oauth/x')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
        token_type: 'bearer',
      }),
    )

    const tokens = await refreshXToken({
      refreshToken: 'old-refresh',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchMock,
    })

    const [, init] = fetchMock.mock.calls[0]!
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh')
    expect(tokens.accessToken).toBe('new-access')
    expect(tokens.refreshToken).toBe('new-refresh')
  })
})

describe('fetchXProfile', () => {
  it('hits /2/users/me with the bearer token and returns the profile', async () => {
    const { fetchXProfile } = await import('../app/lib/server/oauth/x')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        data: {
          id: '123',
          name: 'Ada Lovelace',
          username: 'ada',
          profile_image_url: 'https://example.com/ada.jpg',
        },
      }),
    )

    const profile = await fetchXProfile({ accessToken: 'token-value', fetchImpl: fetchMock })

    const [calledUrl, init] = fetchMock.mock.calls[0]!
    expect(calledUrl).toContain('https://api.x.com/2/users/me')
    expect(calledUrl).toContain('user.fields=profile_image_url')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token-value')
    expect(profile).toEqual({
      id: '123',
      name: 'Ada Lovelace',
      username: 'ada',
      profileImageUrl: 'https://example.com/ada.jpg',
    })
  })

  it('throws when the profile endpoint returns an error', async () => {
    const { fetchXProfile } = await import('../app/lib/server/oauth/x')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({ errors: [{ detail: 'Token expired' }] }, 401),
    )

    await expect(
      fetchXProfile({ accessToken: 'token-value', fetchImpl: fetchMock }),
    ).rejects.toThrow(/Token expired/)
  })
})

describe('getXCallbackUrl', () => {
  it('joins origin with the canonical callback path', async () => {
    const { getXCallbackUrl } = await import('../app/lib/server/oauth/x')
    expect(getXCallbackUrl('https://app.example.com')).toBe(
      'https://app.example.com/integrations/social/x/callback',
    )
    expect(getXCallbackUrl('http://localhost:5173/')).toBe(
      'http://127.0.0.1:5173/integrations/social/x/callback',
    )
  })
})

describe('requireXOAuthConfig', () => {
  beforeEach(() => {
    clearOAuthEnv()
    vi.resetModules()
  })

  afterEach(() => {
    restoreOAuthEnv()
  })

  it('throws a friendly error when X is not configured', async () => {
    vi.doMock('../app/lib/server/instance-config', () => ({
      getInstanceOAuthConfig: async () => ({ x: null, linkedin: null }),
    }))
    const { requireXOAuthConfig } = await import('../app/lib/server/oauth/x')

    await expect(requireXOAuthConfig()).rejects.toThrow(/X OAuth credentials are not configured/)
  })

  it('returns the configured X provider', async () => {
    vi.doMock('../app/lib/server/instance-config', () => ({
      getInstanceOAuthConfig: async () => ({
        x: { clientId: 'cid', clientSecret: 'csec', source: 'env' as const },
        linkedin: null,
      }),
    }))
    const { requireXOAuthConfig } = await import('../app/lib/server/oauth/x')

    await expect(requireXOAuthConfig()).resolves.toEqual({
      clientId: 'cid',
      clientSecret: 'csec',
      source: 'env',
    })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Wraps `vi.fn` with the `fetch`-compatible signature so `mock.calls[i]` is a
 * `[url, init]` tuple instead of `[]`. Without this the strict TS config
 * can't narrow the args inside test assertions.
 */
function makeFetchMock(
  impl: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn<typeof fetch>(async (input, init) => impl(input, init))
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
