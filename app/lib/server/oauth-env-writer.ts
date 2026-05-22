import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  mergeOAuthEnvContent,
  OAUTH_ENV_VAR_NAMES,
  type OAuthEnvUpdates,
  type OAuthEnvVarName,
} from '../oauth-env-file'
import { getDb } from '../db/client'

const LEGACY_INSTANCE_CONFIG_KEYS = [
  'x_client_id',
  'x_client_secret',
  'linkedin_client_id',
  'linkedin_client_secret',
] as const

export type WriteOAuthEnvResult = {
  envFilePath: string
  updatedKeys: OAuthEnvVarName[]
  createdFile: boolean
}

/**
 * Resolves the project-root `.env` path (same directory as the running process).
 */
export function resolveProjectEnvFilePath(): string {
  return join(process.cwd(), '.env')
}

/**
 * Writes OAuth credential updates into `.env`, creating the file from
 * `.env.example` when missing. Never replaces unrelated lines.
 */
export async function writeOAuthCredentialsToEnv(
  updates: OAuthEnvUpdates,
): Promise<WriteOAuthEnvResult> {
  const envFilePath = resolveProjectEnvFilePath()
  const { content, createdFile } = readEnvBootstrapContent(envFilePath)
  const merged = mergeOAuthEnvContent(content, updates)

  const tmpPath = `${envFilePath}.tmp.${process.pid}`
  writeFileSync(tmpPath, merged, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmpPath, envFilePath)

  const updatedKeys = OAUTH_ENV_VAR_NAMES.filter(
    (key) => updates[key] !== undefined && updates[key] !== null && updates[key]?.trim() !== '',
  )

  applyOAuthEnvToProcess(updates)
  await clearLegacyDbOAuthCredentials()

  return { envFilePath, updatedKeys, createdFile }
}

export function applyOAuthEnvToProcess(updates: OAuthEnvUpdates) {
  for (const key of OAUTH_ENV_VAR_NAMES) {
    const value = updates[key]
    if (value === undefined) continue
    if (value === null || value.trim() === '') {
      delete process.env[key]
      continue
    }
    process.env[key] = value.trim()
  }
}

function readEnvBootstrapContent(envFilePath: string): { content: string; createdFile: boolean } {
  if (existsSync(envFilePath)) {
    return { content: readFileSync(envFilePath, 'utf8'), createdFile: false }
  }

  const examplePath = join(dirname(envFilePath), '.env.example')
  if (existsSync(examplePath)) {
    return { content: readFileSync(examplePath, 'utf8'), createdFile: true }
  }

  return {
    content: '# OAuth credentials — see docs/developer-oauth-setup.md\n',
    createdFile: true,
  }
}

/** Removes legacy encrypted OAuth rows if an older build stored them in Postgres. */
async function clearLegacyDbOAuthCredentials() {
  const db = getDb()
  for (const key of LEGACY_INSTANCE_CONFIG_KEYS) {
    await db.query('delete from instance_config where key = $1', [key])
  }
}
