/**
 * Pure helpers for merging OAuth credential lines into a project `.env` file.
 * Used by the setup wizard, Settings → Developers, and scripts/write-oauth-env.mjs.
 */

export const OAUTH_ENV_VAR_NAMES = [
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
] as const

export type OAuthEnvVarName = (typeof OAUTH_ENV_VAR_NAMES)[number]

/** `undefined` = leave unchanged; `null` or `''` = remove the line. */
export type OAuthEnvUpdates = Partial<Record<OAuthEnvVarName, string | null | undefined>>

const ENV_KEY_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/

/**
 * Merges OAuth env updates into existing `.env` content without touching unrelated
 * lines, comments, or ordering of non-OAuth keys.
 */
export function mergeOAuthEnvContent(
  existingContent: string,
  updates: OAuthEnvUpdates,
): string {
  const touched = new Set<OAuthEnvVarName>()
  const lines = existingContent.length === 0 ? [] : existingContent.split('\n')
  const result: string[] = []

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('#') || trimmed === '') {
      result.push(line)
      continue
    }

    const match = line.match(ENV_KEY_PATTERN)
    if (!match) {
      result.push(line)
      continue
    }

    const key = match[1] as OAuthEnvVarName
    if (!isOAuthEnvVarName(key)) {
      result.push(line)
      continue
    }

    if (!(key in updates) || updates[key] === undefined) {
      result.push(line)
      continue
    }

    touched.add(key)
    const value = updates[key]
    if (value === null || value.trim() === '') {
      continue
    }

    result.push(`${key}=${formatEnvValue(value.trim())}`)
  }

  for (const key of OAUTH_ENV_VAR_NAMES) {
    if (touched.has(key)) continue
    const value = updates[key]
    if (value === undefined || value === null || value.trim() === '') continue
    result.push(`${key}=${formatEnvValue(value.trim())}`)
  }

  const joined = result.join('\n')
  return joined.endsWith('\n') ? joined : `${joined}\n`
}

export function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9_\-./+=:@]+$/.test(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function parseEnvValue(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return trimmed
}

export function readOAuthVarsFromEnvContent(content: string): Partial<Record<OAuthEnvVarName, string>> {
  const values: Partial<Record<OAuthEnvVarName, string>> = {}
  for (const line of content.split('\n')) {
    const match = line.match(ENV_KEY_PATTERN)
    if (!match) continue
    const key = match[1] as OAuthEnvVarName
    if (!isOAuthEnvVarName(key)) continue
    values[key] = parseEnvValue(match[2] ?? '')
  }
  return values
}

function isOAuthEnvVarName(key: string): key is OAuthEnvVarName {
  return (OAUTH_ENV_VAR_NAMES as readonly string[]).includes(key)
}
