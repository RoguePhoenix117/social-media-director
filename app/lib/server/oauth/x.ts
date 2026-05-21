import { getInstanceOAuthConfig, type InstanceOAuthProviderConfig } from '../instance-config'

/**
 * X (Twitter) OAuth 2.0 PKCE primitives. NOT OAuth 1.0a.
 *
 * The token endpoint requires HTTP Basic auth (client_id:client_secret) for
 * confidential clients even when PKCE is used — see
 * https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code.
 *
 * Scope: `tweet.read tweet.write users.read offline.access`. `offline.access`
 * is required to receive a refresh token; without it the access token expires
 * in ~2 hours and the user has to reconnect.
 */

const AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const USER_PROFILE_URL =
  'https://api.x.com/2/users/me?user.fields=profile_image_url,username,name'

export const X_OAUTH_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] as const

const X_CALLBACK_PATH = '/integrations/social/x/callback'

export type XOAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scope: string | null
  tokenType: string
}

export type XUserProfile = {
  id: string
  name: string
  username: string
  profileImageUrl: string | null
}

export function getXCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${X_CALLBACK_PATH}`
}

export async function requireXOAuthConfig(): Promise<InstanceOAuthProviderConfig> {
  const config = await getInstanceOAuthConfig()
  if (!config.x) {
    throw new Error(
      'X OAuth credentials are not configured. Ask the instance owner to complete Setup Mode.',
    )
  }
  return config.x
}

export function buildXAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: X_OAUTH_SCOPES.join(' '),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeXCode(input: {
  code: string
  codeVerifier: string
  redirectUri: string
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
}): Promise<XOAuthTokens> {
  const fetchImpl = input.fetchImpl ?? fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
  })

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth(input.clientId, input.clientSecret),
      accept: 'application/json',
    },
    body: body.toString(),
  })

  const json = (await response.json().catch(() => ({}))) as XTokenResponse
  if (!response.ok || !json.access_token) {
    throw new Error(formatTokenError(json, response.statusText))
  }

  return parseTokenResponse(json)
}

export async function refreshXToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
}): Promise<XOAuthTokens> {
  const fetchImpl = input.fetchImpl ?? fetch
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
  })

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth(input.clientId, input.clientSecret),
      accept: 'application/json',
    },
    body: body.toString(),
  })

  const json = (await response.json().catch(() => ({}))) as XTokenResponse
  if (!response.ok || !json.access_token) {
    throw new Error(formatTokenError(json, response.statusText))
  }

  return parseTokenResponse(json)
}

export async function fetchXProfile(input: {
  accessToken: string
  fetchImpl?: typeof fetch
}): Promise<XUserProfile> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(USER_PROFILE_URL, {
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      accept: 'application/json',
    },
  })
  const json = (await response.json().catch(() => ({}))) as XProfileResponse
  if (!response.ok || !json.data?.id) {
    throw new Error(formatTokenError(json, response.statusText))
  }
  return {
    id: json.data.id,
    name: json.data.name ?? json.data.username ?? json.data.id,
    username: json.data.username ?? '',
    profileImageUrl: json.data.profile_image_url ?? null,
  }
}

type XTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type XProfileResponse = {
  data?: {
    id?: string
    name?: string
    username?: string
    profile_image_url?: string | null
  }
  errors?: Array<{ detail?: string; title?: string; message?: string }>
  detail?: string
  title?: string
}

function parseTokenResponse(json: XTokenResponse): XOAuthTokens {
  const expiresAt =
    typeof json.expires_in === 'number' && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000)
      : null
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scope: json.scope ?? null,
    tokenType: json.token_type ?? 'bearer',
  }
}

function formatTokenError(json: XTokenResponse | XProfileResponse, fallback: string): string {
  if ('error_description' in json && json.error_description) return String(json.error_description)
  if ('error' in json && json.error) return String(json.error)
  if ('errors' in json && json.errors?.length) {
    return json.errors
      .map((entry) => entry.detail ?? entry.title ?? entry.message)
      .filter(Boolean)
      .join(' ')
  }
  if ('detail' in json && json.detail) return String(json.detail)
  return fallback || 'X OAuth request failed.'
}

function basicAuth(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  return `Basic ${encoded}`
}
