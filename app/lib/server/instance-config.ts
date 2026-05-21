import { getDb } from '../db/client'
import { decryptSecret, encryptSecret } from './crypto'

export type InstanceOAuthProviderConfig = {
  clientId: string
  clientSecret: string
  source: 'env' | 'db'
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

const INSTANCE_CONFIG_KEYS = {
  xClientId: 'x_client_id',
  xClientSecret: 'x_client_secret',
  linkedinClientId: 'linkedin_client_id',
  linkedinClientSecret: 'linkedin_client_secret',
} as const

type InstanceConfigKey = (typeof INSTANCE_CONFIG_KEYS)[keyof typeof INSTANCE_CONFIG_KEYS]

/**
 * Returns OAuth app credentials for the instance.
 * Env vars (`X_CLIENT_ID`, `X_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`,
 * `LINKEDIN_CLIENT_SECRET`) take precedence over DB-stored values; this allows
 * deployers to bake creds into env without exposing them through the UI.
 */
export async function getInstanceOAuthConfig(): Promise<InstanceOAuthConfig> {
  const dbValues = await loadInstanceConfigMap()

  const xClientId = process.env.X_CLIENT_ID ?? dbValues.get(INSTANCE_CONFIG_KEYS.xClientId)
  const xClientSecret =
    process.env.X_CLIENT_SECRET ?? dbValues.get(INSTANCE_CONFIG_KEYS.xClientSecret)
  const linkedinClientId =
    process.env.LINKEDIN_CLIENT_ID ?? dbValues.get(INSTANCE_CONFIG_KEYS.linkedinClientId)
  const linkedinClientSecret =
    process.env.LINKEDIN_CLIENT_SECRET ?? dbValues.get(INSTANCE_CONFIG_KEYS.linkedinClientSecret)

  return {
    x:
      xClientId && xClientSecret
        ? {
            clientId: xClientId,
            clientSecret: xClientSecret,
            source: process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET ? 'env' : 'db',
          }
        : null,
    linkedin:
      linkedinClientId && linkedinClientSecret
        ? {
            clientId: linkedinClientId,
            clientSecret: linkedinClientSecret,
            source:
              process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET ? 'env' : 'db',
          }
        : null,
  }
}

export async function saveInstanceOAuthConfig(input: InstanceOAuthConfigInput) {
  const updates: Array<{ key: InstanceConfigKey; value: string | null | undefined }> = [
    { key: INSTANCE_CONFIG_KEYS.xClientId, value: input.xClientId },
    { key: INSTANCE_CONFIG_KEYS.xClientSecret, value: input.xClientSecret },
    { key: INSTANCE_CONFIG_KEYS.linkedinClientId, value: input.linkedinClientId },
    { key: INSTANCE_CONFIG_KEYS.linkedinClientSecret, value: input.linkedinClientSecret },
  ]

  const db = getDb()
  for (const { key, value } of updates) {
    if (value === undefined) continue

    if (value === null || value.trim() === '') {
      await db.query('delete from instance_config where key = $1', [key])
      continue
    }

    await db.query(
      `insert into instance_config (key, value_ciphertext, updated_at)
       values ($1, $2, now())
       on conflict (key)
       do update set value_ciphertext = excluded.value_ciphertext, updated_at = now()`,
      [key, encryptSecret(value.trim())],
    )
  }
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
 * The instance is "configured" once both X + LinkedIn OAuth credentials are
 * present (env or DB) and `instance_meta.configured` is true. The setup wizard
 * (PR2) sets the meta flag; env-only deployments are also considered
 * configured if both providers resolve.
 */
export async function isInstanceConfigured(): Promise<boolean> {
  const [config, meta] = await Promise.all([getInstanceOAuthConfig(), readInstanceMeta()])
  const credsPresent = Boolean(config.x && config.linkedin)
  if (!credsPresent) return false
  return meta.configured || envHasAllProviders()
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

function envHasAllProviders(): boolean {
  return Boolean(
    process.env.X_CLIENT_ID &&
      process.env.X_CLIENT_SECRET &&
      process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET,
  )
}

async function loadInstanceConfigMap(): Promise<Map<InstanceConfigKey, string>> {
  const result = await getDb().query<{ key: string; value_ciphertext: string }>(
    'select key, value_ciphertext from instance_config',
  )
  const map = new Map<InstanceConfigKey, string>()
  for (const row of result.rows) {
    if (!isInstanceConfigKey(row.key)) continue
    map.set(row.key, decryptSecret(row.value_ciphertext))
  }
  return map
}

function isInstanceConfigKey(key: string): key is InstanceConfigKey {
  return (Object.values(INSTANCE_CONFIG_KEYS) as readonly string[]).includes(key)
}
