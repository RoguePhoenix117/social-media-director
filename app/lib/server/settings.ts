import type { AiBackendType } from '../domain/ai-backends'
import { isAiBackendType } from '../domain/ai-backends'
import { getDb } from '../db/client'
import { getCodexCliStatus } from './codex-cli'
import { decryptSecret, encryptSecret } from './crypto'
import { getProjectChannel } from './provider-accounts'
import { readOperatorSession } from './session'

/**
 * Operator-scoped AI configuration (per-operator) — channel tokens live in
 * project-scoped `provider_accounts`, not here. The PR4 hard cutover removed
 * the legacy `app_settings` social token paste path entirely; OAuth is now
 * the only way to connect a channel.
 */
export type OperatorAiSettings = {
  activeAiBackendType: AiBackendType | null
  openaiApiKey?: string
  openaiModel?: string
  ollamaHost?: string
  ollamaModel?: string
  openaiCompatibleProviderName?: string
  openaiCompatibleBaseUrl?: string
  openaiCompatibleApiKey?: string
  openaiCompatibleModel?: string
  codexCliModel?: string
  templateVerifiedAt?: string | null
  openaiVerifiedAt?: string | null
  ollamaVerifiedAt?: string | null
  openaiCompatibleVerifiedAt?: string | null
  codexVerifiedAt?: string | null
}

/** Back-compat alias for code that still imports `AppSettings`. */
export type AppSettings = OperatorAiSettings

export type PublicSettingsStatus = {
  modelConfigured: boolean
  activeAiBackendType: AiBackendType | null
  templateConfigured: boolean
  openaiConfigured: boolean
  ollamaConfigured: boolean
  openaiCompatibleConfigured: boolean
  codexConfigured: boolean
  codexReady: boolean
  codexCliEnabled: boolean
  xConfigured: boolean
  linkedinConfigured: boolean
  openaiModel?: string
  ollamaHost?: string
  ollamaModel?: string
  openaiCompatibleProviderName?: string
  openaiCompatibleBaseUrl?: string
  openaiCompatibleModel?: string
  codexCliModel?: string
  configuredAiBackendTypes: AiBackendType[]
}

const legacyAiSettingKeys = ['aiProvider', 'openaiApiKey', 'openaiModel', 'codexCliModel'] as const

export async function getAppSettings(): Promise<OperatorAiSettings> {
  const session = await readOperatorSession()
  const operatorId = session?.operatorId
  return operatorId ? getOperatorAiSettings(operatorId) : emptyOperatorAiSettings()
}

export async function getOperatorAiSettings(operatorId: string): Promise<OperatorAiSettings> {
  await ensureOperatorSettingsRow(operatorId)
  await migrateLegacyAiSettings(operatorId)
  return loadOperatorAiSettings(operatorId)
}

type OperatorAiSettingsRow = {
  active_ai_backend_type: string | null
  openai_api_key_ciphertext: string | null
  openai_model: string | null
  template_verified_at: string | null
  ollama_host: string | null
  ollama_model: string | null
  ollama_verified_at: string | null
  openai_compatible_provider_name: string | null
  openai_compatible_base_url: string | null
  openai_compatible_api_key_ciphertext: string | null
  openai_compatible_model: string | null
  openai_compatible_verified_at: string | null
  codex_cli_model: string | null
  openai_verified_at: string | null
  codex_verified_at: string | null
}

async function loadOperatorAiSettings(operatorId: string): Promise<OperatorAiSettings> {
  const result = await getDb().query<OperatorAiSettingsRow>(
    `select
       active_ai_backend_type,
       openai_api_key_ciphertext,
       openai_model,
       template_verified_at,
       ollama_host,
       ollama_model,
       ollama_verified_at,
       openai_compatible_provider_name,
       openai_compatible_base_url,
       openai_compatible_api_key_ciphertext,
       openai_compatible_model,
       openai_compatible_verified_at,
       codex_cli_model,
       openai_verified_at,
       codex_verified_at
     from operator_settings
     where operator_id = $1`,
    [operatorId],
  )

  return mapOperatorAiSettingsRow(result.rows[0])
}

function mapOperatorAiSettingsRow(row: OperatorAiSettingsRow | undefined): OperatorAiSettings {
  if (!row) return emptyOperatorAiSettings()

  const activeRaw = row.active_ai_backend_type ?? ''
  const activeAiBackendType = isAiBackendType(activeRaw) ? activeRaw : null

  return {
    activeAiBackendType,
    openaiApiKey: row.openai_api_key_ciphertext
      ? decryptSecret(row.openai_api_key_ciphertext)
      : undefined,
    openaiModel: row.openai_model ?? undefined,
    templateVerifiedAt: row.template_verified_at,
    ollamaHost: row.ollama_host ?? undefined,
    ollamaModel: row.ollama_model ?? undefined,
    ollamaVerifiedAt: row.ollama_verified_at,
    openaiCompatibleProviderName: row.openai_compatible_provider_name ?? undefined,
    openaiCompatibleBaseUrl: row.openai_compatible_base_url ?? undefined,
    openaiCompatibleApiKey: row.openai_compatible_api_key_ciphertext
      ? decryptSecret(row.openai_compatible_api_key_ciphertext)
      : undefined,
    openaiCompatibleModel: row.openai_compatible_model ?? undefined,
    openaiCompatibleVerifiedAt: row.openai_compatible_verified_at,
    codexCliModel: row.codex_cli_model ?? undefined,
    openaiVerifiedAt: row.openai_verified_at,
    codexVerifiedAt: row.codex_verified_at,
  }
}

export async function getPublicSettingsStatus(options?: {
  checkCodexAuth?: boolean
  projectId?: string | null
}): Promise<PublicSettingsStatus> {
  const settings = await getAppSettings()
  const checkCodexAuth = options?.checkCodexAuth ?? true
  const codexStatus = checkCodexAuth ? await getCodexCliStatus() : null
  const templateConfigured = Boolean(settings.templateVerifiedAt)
  const openaiConfigured = Boolean(
    settings.openaiApiKey && settings.openaiModel && settings.openaiVerifiedAt,
  )
  const ollamaConfigured = Boolean(
    settings.ollamaHost && settings.ollamaModel && settings.ollamaVerifiedAt,
  )
  const openaiCompatibleConfigured = Boolean(
    settings.openaiCompatibleBaseUrl &&
      settings.openaiCompatibleModel &&
      settings.openaiCompatibleVerifiedAt,
  )
  const codexConfigured = Boolean(settings.codexCliModel && settings.codexVerifiedAt)
  const codexReady = codexConfigured && (checkCodexAuth ? Boolean(codexStatus?.authenticated) : false)
  const configuredAiBackendTypes: AiBackendType[] = []

  if (templateConfigured) configuredAiBackendTypes.push('template')
  if (openaiConfigured) configuredAiBackendTypes.push('openaiApiKey')
  if (ollamaConfigured) configuredAiBackendTypes.push('ollama')
  if (openaiCompatibleConfigured) configuredAiBackendTypes.push('openaiCompatible')
  if (codexReady) configuredAiBackendTypes.push('codexCli')

  const activeAiBackendType = settings.activeAiBackendType
  const activeReady =
    activeAiBackendType === 'openaiApiKey'
      ? openaiConfigured
      : activeAiBackendType === 'ollama'
        ? ollamaConfigured
        : activeAiBackendType === 'openaiCompatible'
          ? openaiCompatibleConfigured
          : activeAiBackendType === 'template'
            ? templateConfigured
      : activeAiBackendType === 'codexCli'
        ? codexReady
        : false

  const channelStatus = await getProjectChannelStatus(options?.projectId ?? null)

  return {
    modelConfigured: configuredAiBackendTypes.length > 0 && Boolean(activeAiBackendType && activeReady),
    activeAiBackendType,
    templateConfigured,
    openaiConfigured,
    ollamaConfigured,
    openaiCompatibleConfigured,
    codexConfigured,
    codexReady,
    codexCliEnabled: activeAiBackendType === 'codexCli',
    xConfigured: channelStatus.xConfigured,
    linkedinConfigured: channelStatus.linkedinConfigured,
    openaiModel: settings.openaiModel,
    ollamaHost: settings.ollamaHost,
    ollamaModel: settings.ollamaModel,
    openaiCompatibleProviderName: settings.openaiCompatibleProviderName,
    openaiCompatibleBaseUrl: settings.openaiCompatibleBaseUrl,
    openaiCompatibleModel: settings.openaiCompatibleModel,
    codexCliModel: settings.codexCliModel,
    configuredAiBackendTypes,
  }
}

/**
 * Project-scoped channel status sourced from `provider_accounts`. When no
 * active project is set (e.g. pre-onboarding bootstrap), both flags are false.
 */
async function getProjectChannelStatus(projectId: string | null) {
  if (!projectId) return { xConfigured: false, linkedinConfigured: false }
  const [x, linkedin] = await Promise.all([
    getProjectChannel(projectId, 'x'),
    getProjectChannel(projectId, 'linkedin'),
  ])
  return {
    xConfigured: Boolean(x),
    linkedinConfigured: Boolean(linkedin),
  }
}

export async function saveOperatorAiConnection(
  operatorId: string,
  backendType: AiBackendType,
  input: {
    openaiApiKey?: string
    openaiModel?: string
    ollamaHost?: string
    ollamaModel?: string
    openaiCompatibleProviderName?: string
    openaiCompatibleBaseUrl?: string
    openaiCompatibleApiKey?: string
    openaiCompatibleModel?: string
    codexCliModel?: string
    markVerified?: boolean
    setActiveIfUnset?: boolean
  },
) {
  await ensureOperatorSettingsRow(operatorId)
  const current = await getOperatorAiSettings(operatorId)
  const setActive =
    input.setActiveIfUnset && current.activeAiBackendType === null ? backendType : undefined

  if (backendType === 'openaiApiKey') {
    await getDb().query(
      `update operator_settings
       set openai_api_key_ciphertext = coalesce($2, openai_api_key_ciphertext),
           openai_model = coalesce($3, openai_model),
           openai_verified_at = case when $4 then now() else openai_verified_at end,
           active_ai_backend_type = coalesce($5, active_ai_backend_type),
           updated_at = now()
       where operator_id = $1`,
      [
        operatorId,
        input.openaiApiKey ? encryptSecret(input.openaiApiKey.trim()) : null,
        input.openaiModel ?? null,
        Boolean(input.markVerified),
        setActive ?? null,
      ],
    )
    return
  }

  if (backendType === 'template') {
    await getDb().query(
      `update operator_settings
       set template_verified_at = case when $2 then now() else template_verified_at end,
           active_ai_backend_type = coalesce($3, active_ai_backend_type),
           updated_at = now()
       where operator_id = $1`,
      [operatorId, Boolean(input.markVerified), setActive ?? null],
    )
    return
  }

  if (backendType === 'ollama') {
    await getDb().query(
      `update operator_settings
       set ollama_host = coalesce($2, ollama_host),
           ollama_model = coalesce($3, ollama_model),
           ollama_verified_at = case when $4 then now() else ollama_verified_at end,
           active_ai_backend_type = coalesce($5, active_ai_backend_type),
           updated_at = now()
       where operator_id = $1`,
      [
        operatorId,
        input.ollamaHost ?? null,
        input.ollamaModel ?? null,
        Boolean(input.markVerified),
        setActive ?? null,
      ],
    )
    return
  }

  if (backendType === 'openaiCompatible') {
    await getDb().query(
      `update operator_settings
       set openai_compatible_provider_name = coalesce($2, openai_compatible_provider_name),
           openai_compatible_base_url = coalesce($3, openai_compatible_base_url),
           openai_compatible_api_key_ciphertext = coalesce($4, openai_compatible_api_key_ciphertext),
           openai_compatible_model = coalesce($5, openai_compatible_model),
           openai_compatible_verified_at = case when $6 then now() else openai_compatible_verified_at end,
           active_ai_backend_type = coalesce($7, active_ai_backend_type),
           updated_at = now()
       where operator_id = $1`,
      [
        operatorId,
        input.openaiCompatibleProviderName ?? null,
        input.openaiCompatibleBaseUrl ?? null,
        input.openaiCompatibleApiKey
          ? encryptSecret(input.openaiCompatibleApiKey.trim())
          : null,
        input.openaiCompatibleModel ?? null,
        Boolean(input.markVerified),
        setActive ?? null,
      ],
    )
    return
  }

  await getDb().query(
    `update operator_settings
     set codex_cli_model = coalesce($2, codex_cli_model),
         codex_verified_at = case when $3 then now() else codex_verified_at end,
         active_ai_backend_type = coalesce($4, active_ai_backend_type),
         updated_at = now()
     where operator_id = $1`,
    [
      operatorId,
      input.codexCliModel ?? null,
      Boolean(input.markVerified),
      setActive ?? null,
    ],
  )
}

export async function setActiveAiBackend(operatorId: string, backendType: AiBackendType | null) {
  await ensureOperatorSettingsRow(operatorId)
  await getDb().query(
    `update operator_settings
     set active_ai_backend_type = $2,
         updated_at = now()
     where operator_id = $1`,
    [operatorId, backendType],
  )
}

export function getGenerationAiConfig(settings: AppSettings & OperatorAiSettings) {
  const active = settings.activeAiBackendType
  if (!active) return null

  if (active === 'codexCli') {
    return {
      aiProvider: 'codexCli' as const,
      codexCliModel: settings.codexCliModel,
    }
  }

  if (active === 'template') {
    return {
      aiProvider: 'template' as const,
    }
  }

  if (active === 'ollama') {
    return {
      aiProvider: 'ollama' as const,
      ollamaHost: settings.ollamaHost,
      ollamaModel: settings.ollamaModel,
    }
  }

  if (active === 'openaiCompatible') {
    return {
      aiProvider: 'openaiCompatible' as const,
      openaiCompatibleProviderName: settings.openaiCompatibleProviderName,
      openaiCompatibleBaseUrl: settings.openaiCompatibleBaseUrl,
      openaiCompatibleApiKey: settings.openaiCompatibleApiKey,
      openaiCompatibleModel: settings.openaiCompatibleModel,
    }
  }

  return {
    aiProvider: 'openaiApiKey' as const,
    openaiApiKey: settings.openaiApiKey,
    openaiModel: settings.openaiModel,
  }
}

async function ensureOperatorSettingsRow(operatorId: string) {
  await getDb().query(
    `insert into operator_settings (operator_id)
     values ($1)
     on conflict (operator_id) do nothing`,
    [operatorId],
  )
}

async function migrateLegacyAiSettings(operatorId: string) {
  const legacy = await getDb().query<{ key: string; value_ciphertext: string }>(
    `select key, value_ciphertext
     from app_settings
     where key = any($1::text[])`,
    [legacyAiSettingKeys],
  )
  if (!legacy.rows.length) return

  const current = await loadOperatorAiSettings(operatorId)
  if (
    current.openaiApiKey ||
    current.openaiModel ||
    current.codexCliModel ||
    current.activeAiBackendType
  ) {
    return
  }

  const values = Object.fromEntries(legacy.rows.map((row) => [row.key, decryptSecret(row.value_ciphertext)]))
  const active = isAiBackendType(values.aiProvider ?? '') ? values.aiProvider : null

  await getDb().query(
    `update operator_settings
     set active_ai_backend_type = $2,
         openai_api_key_ciphertext = $3,
         openai_model = $4,
         codex_cli_model = $5,
         openai_verified_at = case
           when $3::text is not null and $4::text is not null then now()
           else null
         end,
         codex_verified_at = case when $5::text is not null then now() else null end,
         updated_at = now()
     where operator_id = $1`,
    [
      operatorId,
      active,
      values.openaiApiKey ? encryptSecret(values.openaiApiKey) : null,
      values.openaiModel ?? null,
      values.codexCliModel ?? null,
    ],
  )

  for (const key of legacyAiSettingKeys) {
    await getDb().query('delete from app_settings where key = $1', [key])
  }
}

function emptyOperatorAiSettings(): OperatorAiSettings {
  return {
    activeAiBackendType: null,
  }
}
