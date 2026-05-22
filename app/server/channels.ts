import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { encryptSecret } from '../lib/server/crypto'
import { logError, logInfo } from '../lib/server/logger'
import {
  buildLinkedInAuthorizeUrl,
  exchangeLinkedInCode,
  fetchLinkedInProfile,
  getLinkedInCallbackUrl,
  requireLinkedInOAuthConfig,
} from '../lib/server/oauth/linkedin'
import {
  buildXAuthorizeUrl,
  exchangeXCode,
  fetchXProfile,
  getXCallbackUrl,
  requireXOAuthConfig,
} from '../lib/server/oauth/x'
import {
  consumeOAuthState,
  createOAuthState,
  purgeExpiredOAuthStates,
} from '../lib/server/oauth/state'
import {
  getProjectChannel,
  listPublicProjectChannels,
  upsertProviderAccount,
  type PublicProjectChannel,
} from '../lib/server/provider-accounts'
import { requireActiveProjectId, setActiveProject } from '../lib/server/projects'
import { resolveAppOrigin } from '../lib/local-dev-origin'
import { requireOperatorSession } from '../lib/server/session'

/**
 * Server entry points for project channels.
 *
 * `start{Provider}OAuth` and `complete{Provider}OAuth` orchestrate the OAuth
 * authorization-code flows. Each handler throws `redirect()` so the route
 * loaders that call them just need `loader: () => startXOAuth()` — no manual
 * response wiring.
 *
 * `listProjectChannels` is the public read API used for testing in PR3 and
 * by the Connect Channels UI in PR4.
 */

const callbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const listProjectChannels = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ activeProjectId: string | null; channels: PublicProjectChannel[] }> => {
    const session = await requireOperatorSession()
    try {
      const activeProjectId = await requireActiveProjectId(session)
      return {
        activeProjectId,
        channels: await listPublicProjectChannels(activeProjectId),
      }
    } catch {
      return { activeProjectId: null, channels: [] }
    }
  },
)

export const startXOAuth = createServerFn({ method: 'GET' }).handler(async (): Promise<never> => {
  const session = await requireOperatorSession()
  const activeProjectId = await requireActiveProjectId(session)

  const config = await requireXOAuthConfig()
  const existing = await getProjectChannel(activeProjectId, 'x')
  if (existing) {
    throw new Error('X is already connected for this project. Disconnect it first to reconnect.')
  }

  const origin = resolveCurrentOrigin()
  const redirectUri = getXCallbackUrl(origin)

  await purgeExpiredOAuthStates().catch((error) => {
    logError('oauth.state.purge_failed', error)
  })

  const { stateToken, codeChallenge } = await createOAuthState({
    operatorId: session.operatorId,
    projectId: activeProjectId,
    provider: 'x',
  })

  const authorizeUrl = buildXAuthorizeUrl({
    clientId: config.clientId,
    redirectUri,
    state: stateToken,
    codeChallenge,
  })

  logInfo('oauth.x.start', {
    projectId: activeProjectId,
    operatorId: session.operatorId,
  })

  throw redirect({ href: authorizeUrl })
})

export const completeXOAuth = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => callbackSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<never> => {
    const session = await requireOperatorSession()

    if (data.error) {
      logInfo('oauth.x.callback.provider_error', {
        error: data.error,
        description: data.error_description ?? null,
      })
      throw redirect({
        to: '/',
        search: { channel_error: data.error_description || data.error || 'unknown_error' } as never,
      })
    }

    if (!data.code || !data.state) {
      throw new Error('OAuth callback is missing the authorization code or state.')
    }

    const stateRecord = await consumeOAuthState({
      stateToken: data.state,
      expectedOperatorId: session.operatorId,
      expectedProvider: 'x',
    })
    if (!stateRecord) {
      throw new Error('OAuth state is invalid or expired. Please start the connection again.')
    }

    await setActiveProject({
      sessionId: session.sessionId,
      operatorId: session.operatorId,
      projectId: stateRecord.projectId,
    })

    const config = await requireXOAuthConfig()
    const origin = resolveCurrentOrigin()
    const redirectUri = getXCallbackUrl(origin)

    try {
      const tokens = await exchangeXCode({
        code: data.code,
        codeVerifier: stateRecord.codeVerifier,
        redirectUri,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })

      const profile = await fetchXProfile({ accessToken: tokens.accessToken })

      await upsertProviderAccount({
        projectId: stateRecord.projectId,
        provider: 'x',
        externalAccountId: profile.id,
        displayName: profile.name,
        username: profile.username || null,
        profileImageUrl: profile.profileImageUrl,
        accessTokenCiphertext: encryptSecret(tokens.accessToken),
        refreshTokenCiphertext: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
      })

      logInfo('oauth.x.callback.success', {
        projectId: stateRecord.projectId,
        operatorId: session.operatorId,
        externalAccountId: profile.id,
      })
    } catch (error) {
      logError('oauth.x.callback.failure', error, {
        projectId: stateRecord.projectId,
        operatorId: session.operatorId,
      })
      throw error
    }

    throw redirect({
      to: '/integrations/social/adding',
      search: { provider: 'x', next: stateRecord.redirectAfter ?? '/' } as never,
    })
  })

export const startLinkedInOAuth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<never> => {
    const session = await requireOperatorSession()
    const activeProjectId = await requireActiveProjectId(session)

    const config = await requireLinkedInOAuthConfig()
    const existing = await getProjectChannel(activeProjectId, 'linkedin')
    if (existing) {
      throw new Error(
        'LinkedIn is already connected for this project. Disconnect it first to reconnect.',
      )
    }

    const origin = resolveCurrentOrigin()
    const redirectUri = getLinkedInCallbackUrl(origin)

    await purgeExpiredOAuthStates().catch((error) => {
      logError('oauth.state.purge_failed', error)
    })

    const { stateToken } = await createOAuthState({
      operatorId: session.operatorId,
      projectId: activeProjectId,
      provider: 'linkedin',
    })

    const authorizeUrl = buildLinkedInAuthorizeUrl({
      clientId: config.clientId,
      redirectUri,
      state: stateToken,
    })

    logInfo('oauth.linkedin.start', {
      projectId: activeProjectId,
      operatorId: session.operatorId,
    })

    throw redirect({ href: authorizeUrl })
  },
)

export const completeLinkedInOAuth = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => callbackSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<never> => {
    const session = await requireOperatorSession()

    if (data.error) {
      logInfo('oauth.linkedin.callback.provider_error', {
        error: data.error,
        description: data.error_description ?? null,
      })
      throw redirect({
        to: '/',
        search: { channel_error: data.error_description || data.error || 'unknown_error' } as never,
      })
    }

    if (!data.code || !data.state) {
      throw new Error('OAuth callback is missing the authorization code or state.')
    }

    const stateRecord = await consumeOAuthState({
      stateToken: data.state,
      expectedOperatorId: session.operatorId,
      expectedProvider: 'linkedin',
    })
    if (!stateRecord) {
      throw new Error('OAuth state is invalid or expired. Please start the connection again.')
    }

    await setActiveProject({
      sessionId: session.sessionId,
      operatorId: session.operatorId,
      projectId: stateRecord.projectId,
    })

    const config = await requireLinkedInOAuthConfig()
    const origin = resolveCurrentOrigin()
    const redirectUri = getLinkedInCallbackUrl(origin)

    try {
      const tokens = await exchangeLinkedInCode({
        code: data.code,
        redirectUri,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })

      const profile = await fetchLinkedInProfile({ accessToken: tokens.accessToken })

      await upsertProviderAccount({
        projectId: stateRecord.projectId,
        provider: 'linkedin',
        externalAccountId: profile.id,
        displayName: profile.name,
        username: profile.email ?? null,
        profileImageUrl: profile.pictureUrl,
        authorUrn: profile.authorUrn,
        accessTokenCiphertext: encryptSecret(tokens.accessToken),
        refreshTokenCiphertext: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
      })

      logInfo('oauth.linkedin.callback.success', {
        projectId: stateRecord.projectId,
        operatorId: session.operatorId,
        externalAccountId: profile.id,
      })
    } catch (error) {
      logError('oauth.linkedin.callback.failure', error, {
        projectId: stateRecord.projectId,
        operatorId: session.operatorId,
      })
      throw error
    }

    throw redirect({
      to: '/integrations/social/adding',
      search: { provider: 'linkedin', next: stateRecord.redirectAfter ?? '/' } as never,
    })
  })

function resolveCurrentOrigin(): string {
  try {
    const url = getRequestUrl()
    return resolveAppOrigin(`${url.protocol}//${url.host}`)
  } catch {
    return resolveAppOrigin()
  }
}
