import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  getInstanceOAuthConfig,
  isInstanceConfigured,
  markInstanceConfigured,
  readInstanceMeta,
  saveInstanceOAuthCredentials,
} from '../lib/server/instance-config'
import { resolveAppOrigin } from '../lib/local-dev-origin'
import { requireOperatorSession } from '../lib/server/session'
import { assertSetupKeyValid, isLocalhostOrigin } from '../lib/server/setup-guard'
import {
  buildCallbackUrls,
  buildSaveInput,
  computeSetupKeyState,
  toProviderStatus,
  type ProviderName,
  type ProviderSetupStatus,
  type SetupKeyState,
} from '../lib/server/setup-helpers'

/**
 * Setup Mode + Settings → Developers API.
 *
 * OAuth app credentials are written to the project-root `.env` only — never
 * Postgres. Secrets are not returned to the client; the UI sees client IDs and
 * configured flags from `process.env`.
 */

export type { ProviderName, ProviderSetupStatus, SetupKeyState } from '../lib/server/setup-helpers'

export type InstanceSetupStatus = {
  configured: boolean
  setupCompletedAt: string | null
  origin: string
  isLocalhost: boolean
  setupKey: SetupKeyState
  callbackUrls: Record<ProviderName, string>
  providers: Record<ProviderName, ProviderSetupStatus>
}

export type DeveloperSettings = {
  callbackUrls: Record<ProviderName, string>
  providers: Record<ProviderName, ProviderSetupStatus>
}

const setupKeyInputSchema = z.object({
  setupKey: z.string().trim().optional(),
})

const setupSubmitSchema = z.object({
  setupKey: z.string().trim().optional(),
  xClientId: z.string().trim().optional(),
  xClientSecret: z.string().trim().optional(),
  linkedinClientId: z.string().trim().optional(),
  linkedinClientSecret: z.string().trim().optional(),
})

const developerSettingsSchema = z.object({
  xClientId: z.string().trim().optional(),
  xClientSecret: z.string().trim().optional(),
  linkedinClientId: z.string().trim().optional(),
  linkedinClientSecret: z.string().trim().optional(),
})

export const getInstanceSetupStatus = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => setupKeyInputSchema.parse(input ?? {}))
  .handler(async ({ data }) => buildInstanceSetupStatus(data.setupKey))

export const saveInstanceSetup = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => setupSubmitSchema.parse(input))
  .handler(async ({ data }): Promise<InstanceSetupStatus> => {
    const origin = resolveCurrentOrigin()
    assertSetupKeyValid({ origin, providedKey: data.setupKey })

    const current = await getInstanceOAuthConfig()
    await saveInstanceOAuthCredentials(buildSaveInput(current, data))
    await markInstanceConfigured()

    return buildInstanceSetupStatus(data.setupKey)
  })

export const getDeveloperSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DeveloperSettings> => {
    await requireInstanceOwner()
    return buildDeveloperSettings()
  },
)

export const saveDeveloperSettings = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => developerSettingsSchema.parse(input))
  .handler(async ({ data }): Promise<DeveloperSettings> => {
    await requireInstanceOwner()
    const current = await getInstanceOAuthConfig()
    await saveInstanceOAuthCredentials(buildSaveInput(current, data))
    return buildDeveloperSettings()
  })

async function buildInstanceSetupStatus(
  providedSetupKey: string | undefined,
): Promise<InstanceSetupStatus> {
  const origin = resolveCurrentOrigin()
  const [config, meta, configured] = await Promise.all([
    getInstanceOAuthConfig(),
    readInstanceMeta(),
    isInstanceConfigured(),
  ])

  return {
    configured,
    setupCompletedAt: meta.setupCompletedAt,
    origin,
    isLocalhost: isLocalhostOrigin(origin),
    setupKey: computeSetupKeyState({ origin, providedKey: providedSetupKey }),
    callbackUrls: buildCallbackUrls(origin),
    providers: {
      x: toProviderStatus(config.x),
      linkedin: toProviderStatus(config.linkedin),
    },
  }
}

async function buildDeveloperSettings(): Promise<DeveloperSettings> {
  const origin = resolveCurrentOrigin()
  const config = await getInstanceOAuthConfig()
  return {
    callbackUrls: buildCallbackUrls(origin),
    providers: {
      x: toProviderStatus(config.x),
      linkedin: toProviderStatus(config.linkedin),
    },
  }
}

async function requireInstanceOwner() {
  const session = await requireOperatorSession()
  if (!session.isInstanceOwner) {
    throw new Error('Only the instance owner can manage developer settings.')
  }
}

/**
 * Reads the live request URL so localhost gating works in dev without env
 * overrides. Falls back to `APP_ORIGIN` for non-HTTP execution contexts
 * (e.g. tests) and finally to localhost so we never throw at module level.
 */
function resolveCurrentOrigin(): string {
  try {
    const url = getRequestUrl()
    return resolveAppOrigin(`${url.protocol}//${url.host}`)
  } catch {
    return resolveAppOrigin()
  }
}
