import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for the LinkedIn OAuth 2.0 (Authorization Code) primitives.
 * Mirrors `tests/oauth-x.test.ts` so the behaviour stays in lockstep.
 *
 * Coverage:
 *  - LinkedIn-scoped state can be created and consumed via the shared
 *    `oauth_states` table (provider mismatch rejects).
 *  - Authorize URL composes the LinkedIn endpoint, OIDC scopes, and the
 *    deployer's callback URL — and notably does NOT include PKCE params.
 *  - Token exchange POSTs `grant_type=authorization_code` with the client
 *    secret in the form body (LinkedIn does not accept HTTP basic auth).
 *  - Refresh token exchange follows the same wire format.
 *  - `fetchLinkedInProfile` calls `/v2/userinfo` with bearer auth and maps
 *    `sub` into `urn:li:person:{sub}`.
 *  - `requireLinkedInOAuthConfig` surfaces a helpful message when the
 *    instance is not configured.
 *
 * The DB is mocked; no real database is touched.
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

describe('createOAuthState (linkedin provider)', () => {
  beforeEach(() => {
    oauthStateRows.clear()
    nextStateId = 1
  })

  it('persists a linkedin-scoped state row that consume can read once', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'linkedin',
    })

    const consumed = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'linkedin',
    })

    expect(consumed).toMatchObject({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'linkedin',
    })

    const replayed = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'linkedin',
    })
    expect(replayed).toBeNull()
  })

  it('rejects a linkedin state when consumed with provider=x', async () => {
    const { createOAuthState, consumeOAuthState } = await import('../app/lib/server/oauth/state')

    const created = await createOAuthState({
      operatorId: 'op-1',
      projectId: 'proj-1',
      provider: 'linkedin',
    })

    const result = await consumeOAuthState({
      stateToken: created.stateToken,
      expectedOperatorId: 'op-1',
      expectedProvider: 'x',
    })
    expect(result).toBeNull()
  })
})

describe('buildLinkedInAuthorizeUrl', () => {
  it('serializes the OAuth params required by LinkedIn (no PKCE)', async () => {
    const { buildLinkedInAuthorizeUrl, LINKEDIN_OAUTH_SCOPES } = await import(
      '../app/lib/server/oauth/linkedin'
    )

    const url = buildLinkedInAuthorizeUrl({
      clientId: 'client-id',
      redirectUri: 'http://localhost:5173/integrations/social/linkedin/callback',
      state: 'state-token',
    })

    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.linkedin.com/oauth/v2/authorization',
    )
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/integrations/social/linkedin/callback',
    )
    expect(parsed.searchParams.get('scope')).toBe(LINKEDIN_OAUTH_SCOPES.join(' '))
    expect(parsed.searchParams.get('state')).toBe('state-token')
    expect(parsed.searchParams.get('code_challenge')).toBeNull()
    expect(parsed.searchParams.get('code_challenge_method')).toBeNull()
  })
})

describe('exchangeLinkedInCode', () => {
  it('POSTs the token endpoint with the client secret in the form body', async () => {
    const { exchangeLinkedInCode } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 5184000,
        scope: 'openid profile w_member_social',
        token_type: 'Bearer',
        id_token: 'id-token',
      }),
    )

    const tokens = await exchangeLinkedInCode({
      code: 'auth-code',
      redirectUri: 'http://localhost:5173/integrations/social/linkedin/callback',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0]!
    expect(calledUrl).toBe('https://www.linkedin.com/oauth/v2/accessToken')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(headers.authorization).toBeUndefined()

    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('redirect_uri')).toBe(
      'http://localhost:5173/integrations/social/linkedin/callback',
    )
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBe('client-secret')

    expect(tokens.accessToken).toBe('access-token')
    expect(tokens.refreshToken).toBe('refresh-token')
    expect(tokens.idToken).toBe('id-token')
    expect(tokens.expiresAt).toBeInstanceOf(Date)
  })

  it('throws a useful message when LinkedIn returns an oauth error', async () => {
    const { exchangeLinkedInCode } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({ error: 'invalid_grant', error_description: 'Authorization code expired' }, 400),
    )

    await expect(
      exchangeLinkedInCode({
        code: 'auth-code',
        redirectUri: 'http://localhost:5173/integrations/social/linkedin/callback',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Authorization code expired/)
  })
})

describe('refreshLinkedInToken', () => {
  it('POSTs grant_type=refresh_token with client credentials', async () => {
    const { refreshLinkedInToken } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 5184000,
        token_type: 'Bearer',
      }),
    )

    const tokens = await refreshLinkedInToken({
      refreshToken: 'old-refresh',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchMock,
    })

    const [, init] = fetchMock.mock.calls[0]!
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh')
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBe('client-secret')
    expect(tokens.accessToken).toBe('new-access')
    expect(tokens.refreshToken).toBe('new-refresh')
  })
})

describe('fetchLinkedInProfile', () => {
  it('calls /v2/userinfo with the bearer token and builds an author URN from sub', async () => {
    const { fetchLinkedInProfile } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({
        sub: 'abc123',
        name: 'Ada Lovelace',
        given_name: 'Ada',
        family_name: 'Lovelace',
        email: 'ada@example.com',
        email_verified: true,
        picture: 'https://example.com/ada.jpg',
        locale: 'en-US',
      }),
    )

    const profile = await fetchLinkedInProfile({
      accessToken: 'token-value',
      fetchImpl: fetchMock,
    })

    const [calledUrl, init] = fetchMock.mock.calls[0]!
    expect(calledUrl).toBe('https://api.linkedin.com/v2/userinfo')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token-value')
    expect(profile).toEqual({
      id: 'abc123',
      authorUrn: 'urn:li:person:abc123',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      pictureUrl: 'https://example.com/ada.jpg',
    })
  })

  it('falls back to given_name + family_name when name is missing', async () => {
    const { fetchLinkedInProfile } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({ sub: 'xyz', given_name: 'Grace', family_name: 'Hopper' }),
    )

    const profile = await fetchLinkedInProfile({
      accessToken: 'token-value',
      fetchImpl: fetchMock,
    })

    expect(profile.name).toBe('Grace Hopper')
    expect(profile.authorUrn).toBe('urn:li:person:xyz')
    expect(profile.email).toBeNull()
    expect(profile.pictureUrl).toBeNull()
  })

  it('throws when the userinfo endpoint returns an error', async () => {
    const { fetchLinkedInProfile } = await import('../app/lib/server/oauth/linkedin')
    const fetchMock = makeFetchMock(() =>
      jsonResponse({ message: 'Unauthorized', serviceErrorCode: 65600 }, 401),
    )

    await expect(
      fetchLinkedInProfile({ accessToken: 'token-value', fetchImpl: fetchMock }),
    ).rejects.toThrow(/Unauthorized/)
  })
})

describe('getLinkedInCallbackUrl', () => {
  it('joins origin with the canonical callback path', async () => {
    const { getLinkedInCallbackUrl } = await import('../app/lib/server/oauth/linkedin')
    expect(getLinkedInCallbackUrl('https://app.example.com')).toBe(
      'https://app.example.com/integrations/social/linkedin/callback',
    )
    expect(getLinkedInCallbackUrl('http://localhost:5173/')).toBe(
      'http://localhost:5173/integrations/social/linkedin/callback',
    )
  })
})

describe('requireLinkedInOAuthConfig', () => {
  beforeEach(() => {
    clearOAuthEnv()
    vi.resetModules()
  })

  afterEach(() => {
    restoreOAuthEnv()
  })

  it('throws a friendly error when LinkedIn is not configured', async () => {
    vi.doMock('../app/lib/server/instance-config', () => ({
      getInstanceOAuthConfig: async () => ({ x: null, linkedin: null }),
    }))
    const { requireLinkedInOAuthConfig } = await import('../app/lib/server/oauth/linkedin')

    await expect(requireLinkedInOAuthConfig()).rejects.toThrow(
      /LinkedIn OAuth credentials are not configured/,
    )
  })

  it('returns the configured LinkedIn provider', async () => {
    vi.doMock('../app/lib/server/instance-config', () => ({
      getInstanceOAuthConfig: async () => ({
        x: null,
        linkedin: { clientId: 'cid', clientSecret: 'csec', source: 'env' as const },
      }),
    }))
    const { requireLinkedInOAuthConfig } = await import('../app/lib/server/oauth/linkedin')

    await expect(requireLinkedInOAuthConfig()).resolves.toEqual({
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

function makeFetchMock(
  impl: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn<typeof fetch>(async (input, init) => impl(input, init))
}
