import { getInstanceOAuthConfig, type InstanceOAuthProviderConfig } from '../instance-config'

/**
 * LinkedIn OAuth 2.0 (Authorization Code) primitives.
 *
 * Mirrors the X OAuth helpers in `./x.ts` so callers in
 * `app/server/channels.ts` can branch on provider with the same surface area.
 *
 * LinkedIn — like every OpenID Connect provider — accepts the client secret
 * either as Basic auth or as a form parameter. The official LinkedIn docs
 * use the form-parameter style for both `authorization_code` and
 * `refresh_token` exchanges, so we match that. PKCE is NOT used for LinkedIn:
 * the OAuth state row still stores a `code_verifier` (because the column is
 * NOT NULL and shared with the X flow), but it is never sent to LinkedIn.
 *
 * Scopes:
 *   - `openid`            — required to use the OIDC `/v2/userinfo` endpoint
 *   - `profile`           — name + picture in userinfo response
 *   - `w_member_social`   — required to publish to LinkedIn on behalf of the
 *                           authenticated member (Share on LinkedIn product)
 */

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'

export const LINKEDIN_OAUTH_SCOPES = ['openid', 'profile', 'w_member_social'] as const

const LINKEDIN_CALLBACK_PATH = '/integrations/social/linkedin/callback'

export type LinkedInOAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scope: string | null
  tokenType: string
  /** OIDC id token; optional, only present when `openid` scope is granted. */
  idToken: string | null
}

export type LinkedInUserProfile = {
  /** OIDC `sub` claim. Used to build `urn:li:person:{sub}`. */
  id: string
  authorUrn: string
  name: string
  email: string | null
  pictureUrl: string | null
}

export function getLinkedInCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${LINKEDIN_CALLBACK_PATH}`
}

export async function requireLinkedInOAuthConfig(): Promise<InstanceOAuthProviderConfig> {
  const config = await getInstanceOAuthConfig()
  if (!config.linkedin) {
    throw new Error(
      'LinkedIn OAuth credentials are not configured. Ask the instance owner to complete Setup Mode.',
    )
  }
  return config.linkedin
}

export function buildLinkedInAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: LINKEDIN_OAUTH_SCOPES.join(' '),
    state: input.state,
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeLinkedInCode(input: {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
}): Promise<LinkedInOAuthTokens> {
  const fetchImpl = input.fetchImpl ?? fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  })

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: body.toString(),
  })

  const json = (await response.json().catch(() => ({}))) as LinkedInTokenResponse
  if (!response.ok || !json.access_token) {
    throw new Error(formatTokenError(json, response.statusText))
  }

  return parseTokenResponse(json)
}

/**
 * Refresh tokens are only granted to LinkedIn apps that have explicitly
 * enabled the "Refresh tokens" feature; many Sign In with LinkedIn apps
 * receive only a 60-day access token. Callers should treat a thrown error
 * here as "user must reconnect" rather than a bug.
 */
export async function refreshLinkedInToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
}): Promise<LinkedInOAuthTokens> {
  const fetchImpl = input.fetchImpl ?? fetch
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  })

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: body.toString(),
  })

  const json = (await response.json().catch(() => ({}))) as LinkedInTokenResponse
  if (!response.ok || !json.access_token) {
    throw new Error(formatTokenError(json, response.statusText))
  }

  return parseTokenResponse(json)
}

export async function fetchLinkedInProfile(input: {
  accessToken: string
  fetchImpl?: typeof fetch
}): Promise<LinkedInUserProfile> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(USERINFO_URL, {
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      accept: 'application/json',
    },
  })
  const json = (await response.json().catch(() => ({}))) as LinkedInUserInfoResponse
  if (!response.ok || !json.sub) {
    throw new Error(formatTokenError(json, response.statusText))
  }
  const name =
    json.name ||
    [json.given_name, json.family_name].filter(Boolean).join(' ').trim() ||
    json.email ||
    json.sub
  return {
    id: json.sub,
    authorUrn: `urn:li:person:${json.sub}`,
    name,
    email: json.email ?? null,
    pictureUrl: json.picture ?? null,
  }
}

type LinkedInTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
  error?: string
  error_description?: string
}

type LinkedInUserInfoResponse = {
  sub?: string
  name?: string
  given_name?: string
  family_name?: string
  email?: string
  email_verified?: boolean
  picture?: string | null
  locale?: string
  error?: string
  error_description?: string
  message?: string
  serviceErrorCode?: number
}

function parseTokenResponse(json: LinkedInTokenResponse): LinkedInOAuthTokens {
  const expiresAt =
    typeof json.expires_in === 'number' && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000)
      : null
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scope: json.scope ?? null,
    tokenType: json.token_type ?? 'Bearer',
    idToken: json.id_token ?? null,
  }
}

function formatTokenError(
  json: LinkedInTokenResponse | LinkedInUserInfoResponse,
  fallback: string,
): string {
  if ('error_description' in json && json.error_description) return String(json.error_description)
  if ('error' in json && json.error) return String(json.error)
  if ('message' in json && json.message) return String(json.message)
  return fallback || 'LinkedIn OAuth request failed.'
}
