import type {
  InstanceOAuthConfig,
  InstanceOAuthProviderConfig,
} from './instance-config'
import { normalizeLocalDevOrigin } from '../local-dev-origin'
import { isLocalhostOrigin, isSetupKeyConfigured } from './setup-guard'

/**
 * Pure helpers shared between the Setup Mode wizard and the Settings →
 * Developers section. Kept here (not in `app/server/setup.ts`) so they're
 * trivially unit-testable without dragging in `createServerFn` or the request
 * context.
 */

export type ProviderName = 'x' | 'linkedin'

export type ProviderSetupStatus = {
  clientId: string | null
  clientSecretConfigured: boolean
  source: 'env' | 'none'
}

export type SetupKeyState = {
  required: boolean
  /** True when no key is required, OR a valid key was supplied. */
  valid: boolean
  /** True when `INSTANCE_SETUP_KEY` is set in env (regardless of origin). */
  configured: boolean
}

export type ProviderInput = {
  xClientId?: string
  xClientSecret?: string
  linkedinClientId?: string
  linkedinClientSecret?: string
}

export type ProviderSaveUpdates = {
  xClientId?: string | null
  xClientSecret?: string | null
  linkedinClientId?: string | null
  linkedinClientSecret?: string | null
}

/**
 * Builds partial env updates from wizard / developer form input. Blank secrets
 * are omitted so an existing `.env` value is preserved.
 */
export function buildSaveInput(
  _current: InstanceOAuthConfig,
  data: ProviderInput,
): ProviderSaveUpdates {
  const updates: ProviderSaveUpdates = {}

  if (data.xClientId !== undefined) updates.xClientId = data.xClientId
  if (data.xClientSecret !== undefined && data.xClientSecret.trim() !== '') {
    updates.xClientSecret = data.xClientSecret
  }
  if (data.linkedinClientId !== undefined) updates.linkedinClientId = data.linkedinClientId
  if (data.linkedinClientSecret !== undefined && data.linkedinClientSecret.trim() !== '') {
    updates.linkedinClientSecret = data.linkedinClientSecret
  }

  return updates
}

export function toProviderStatus(
  config: InstanceOAuthProviderConfig | null,
): ProviderSetupStatus {
  if (!config) return { clientId: null, clientSecretConfigured: false, source: 'none' }
  return {
    clientId: config.clientId,
    clientSecretConfigured: Boolean(config.clientSecret),
    source: config.source,
  }
}

export function buildCallbackUrls(origin: string): Record<ProviderName, string> {
  const normalized = normalizeLocalDevOrigin(origin)
  return {
    x: `${normalized}/integrations/social/x/callback`,
    linkedin: `${normalized}/integrations/social/linkedin/callback`,
  }
}

export function computeSetupKeyState(input: {
  origin: string
  providedKey: string | undefined
}): SetupKeyState {
  const configured = isSetupKeyConfigured()
  const local = isLocalhostOrigin(input.origin)
  if (local || !configured) {
    return { required: false, valid: true, configured }
  }
  const provided = input.providedKey?.trim() ?? ''
  const expected = process.env.INSTANCE_SETUP_KEY?.trim() ?? ''
  return {
    required: true,
    valid: provided !== '' && provided === expected,
    configured: true,
  }
}
