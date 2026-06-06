import { existsSync, readFileSync } from 'node:fs'
import { getDb } from '../db/client'
import type { OAuthEnvUpdates, OAuthEnvVarName } from '../oauth-env-file'
import { OAUTH_ENV_VAR_NAMES, readOAuthVarsFromEnvContent } from '../oauth-env-file'
import { resolveProjectEnvFilePath, writeOAuthCredentialsToEnv } from './oauth-env-writer'

export type InstanceOAuthProviderConfig = {
  clientId: string
  clientSecret: string
  source: 'env'
}

export type InstanceOAuthConfig = {
  x: InstanceOAuthProviderConfig | null
  linkedin: InstanceOAuthProviderConfig | null
}

export type InstanceOAuthConfigInput = {
  xClientId?: string | null
  xClientSecret?: string | null
  linkedinClientId?: string | null
  linkedinClientSecret?: string | null
}

export type InstanceOAuthProviders = {
  x: boolean
  linkedin: boolean
}

/**
 * Returns OAuth app credentials from environment variables only.
 * Deployer credentials live in the project-root `.env` — never in Postgres.
 */
export async function getInstanceOAuthConfig(): Promise<InstanceOAuthConfig> {
  return {
    x: readProviderFromEnv('X_CLIENT_ID', 'X_CLIENT_SECRET'),
    linkedin: readProviderFromEnv('LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'),
  }
}

/**
 * Merges OAuth credential updates into `.env` and applies them to the current
 * process. Legacy DB rows (pre-env migration) are deleted if present.
 */
export async function saveInstanceOAuthCredentials(input: InstanceOAuthConfigInput) {
  const updates = buildEnvUpdatesFromInput(input)
  if (Object.keys(updates).length === 0) return null
  return writeOAuthCredentialsToEnv(updates)
}

export async function markInstanceConfigured() {
  await getDb().query(
    `update instance_meta
     set configured = true,
         setup_completed_at = coalesce(setup_completed_at, now())
     where id = 1`,
  )
}

/**
 * The instance is "configured" once the deployer finishes Setup Mode
 * (`instance_meta.configured`) or at least one provider is fully configured via
 * env. X and LinkedIn are optional — zero providers is valid after setup.
 */
export async function isInstanceConfigured(): Promise<boolean> {
  const [config, meta] = await Promise.all([getInstanceOAuthConfig(), readInstanceMeta()])
  if (meta.configured) return true
  return Boolean(config.x || config.linkedin)
}

export async function getInstanceOAuthProviders(): Promise<InstanceOAuthProviders> {
  const config = await getInstanceOAuthConfig()
  return {
    x: Boolean(config.x),
    linkedin: Boolean(config.linkedin),
  }
}

export async function readInstanceMeta(): Promise<{
  configured: boolean
  setupCompletedAt: string | null
}> {
  const result = await getDb().query<{ configured: boolean; setup_completed_at: string | null }>(
    'select configured, setup_completed_at from instance_meta where id = 1 limit 1',
  )
  const row = result.rows[0]
  return {
    configured: row?.configured ?? false,
    setupCompletedAt: row?.setup_completed_at ?? null,
  }
}

function readProviderFromEnv(
  clientIdKey: 'X_CLIENT_ID' | 'LINKEDIN_CLIENT_ID',
  clientSecretKey: 'X_CLIENT_SECRET' | 'LINKEDIN_CLIENT_SECRET',
): InstanceOAuthProviderConfig | null {
  const snapshot = readOAuthEnvSnapshot()
  const clientId = snapshot[clientIdKey]?.trim()
  const clientSecret = snapshot[clientSecretKey]?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, source: 'env' }
}

/**
 * OAuth credentials live in the project `.env` file. Vite SSR workers do not
 * always reload that file into `process.env`, so merge file contents with any
 * in-memory overrides (e.g. right after the setup wizard saves credentials).
 */
export function readOAuthEnvSnapshot(): Partial<Record<OAuthEnvVarName, string>> {
  const snapshot: Partial<Record<OAuthEnvVarName, string>> = {}

  const envFilePath = resolveProjectEnvFilePath()
  if (existsSync(envFilePath)) {
    Object.assign(snapshot, readOAuthVarsFromEnvContent(readFileSync(envFilePath, 'utf8')))
  }

  for (const key of OAUTH_ENV_VAR_NAMES) {
    const value = process.env[key]?.trim()
    if (value) snapshot[key] = value
  }

  return snapshot
}

function buildEnvUpdatesFromInput(input: InstanceOAuthConfigInput): OAuthEnvUpdates {
  const updates: OAuthEnvUpdates = {}

  if (input.xClientId !== undefined) {
    updates.X_CLIENT_ID = input.xClientId?.trim() ? input.xClientId.trim() : null
  }
  if (input.xClientSecret !== undefined) {
    const xClientSecret = input.xClientSecret?.trim()
    if (xClientSecret) updates.X_CLIENT_SECRET = xClientSecret
  }
  if (input.linkedinClientId !== undefined) {
    updates.LINKEDIN_CLIENT_ID = input.linkedinClientId?.trim()
      ? input.linkedinClientId.trim()
      : null
  }
  if (input.linkedinClientSecret !== undefined) {
    const linkedinClientSecret = input.linkedinClientSecret?.trim()
    if (linkedinClientSecret) updates.LINKEDIN_CLIENT_SECRET = linkedinClientSecret
  }

  return updates
}

/** @deprecated Use {@link saveInstanceOAuthCredentials} — credentials are env-only. */
export async function saveInstanceOAuthConfig(input: InstanceOAuthConfigInput) {
  return saveInstanceOAuthCredentials(input)
}
