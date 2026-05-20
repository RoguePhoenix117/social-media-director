import { getDb } from '../db/client'
import { decryptSecret, encryptSecret } from './crypto'

export type AppSettings = {
  aiProvider?: string
  openaiApiKey?: string
  openaiModel?: string
  codexCliModel?: string
  xAccessToken?: string
  linkedinAccessToken?: string
  linkedinAuthorUrn?: string
  linkedinApiVersion?: string
}

export type PublicSettingsStatus = {
  modelConfigured: boolean
  aiProvider?: string
  codexCliEnabled: boolean
  xConfigured: boolean
  linkedinConfigured: boolean
  openaiModel?: string
  codexCliModel?: string
  linkedinApiVersion?: string
}

const settingKeys = [
  'aiProvider',
  'openaiApiKey',
  'openaiModel',
  'codexCliModel',
  'xAccessToken',
  'linkedinAccessToken',
  'linkedinAuthorUrn',
  'linkedinApiVersion',
] as const

export async function getAppSettings(): Promise<AppSettings> {
  const result = await getDb().query<{ key: string; value_ciphertext: string }>(
    'select key, value_ciphertext from app_settings',
  )
  const settings: AppSettings = {}

  for (const row of result.rows) {
    if (!isSettingKey(row.key)) continue
    settings[row.key] = decryptSecret(row.value_ciphertext)
  }

  return settings
}

export async function getPublicSettingsStatus(): Promise<PublicSettingsStatus> {
  const settings = await getAppSettings()
  const aiProvider = settings.aiProvider ?? 'openaiApiKey'
  return {
    modelConfigured: aiProvider === 'codexCli' || Boolean(settings.openaiApiKey),
    aiProvider,
    codexCliEnabled: aiProvider === 'codexCli',
    xConfigured: Boolean(settings.xAccessToken),
    linkedinConfigured: Boolean(settings.linkedinAccessToken && settings.linkedinAuthorUrn),
    openaiModel: settings.openaiModel,
    codexCliModel: settings.codexCliModel,
    linkedinApiVersion: settings.linkedinApiVersion,
  }
}

export async function saveAppSettings(settings: AppSettings) {
  const db = getDb()
  for (const key of settingKeys) {
    const value = settings[key]
    if (value === undefined) continue

    if (value.trim() === '') {
      await db.query('delete from app_settings where key = $1', [key])
      continue
    }

    await db.query(
      `insert into app_settings (key, value_ciphertext, updated_at)
       values ($1, $2, now())
       on conflict (key)
       do update set value_ciphertext = excluded.value_ciphertext, updated_at = now()`,
      [key, encryptSecret(value.trim())],
    )
  }
}

function isSettingKey(key: string): key is keyof AppSettings {
  return (settingKeys as readonly string[]).includes(key)
}
