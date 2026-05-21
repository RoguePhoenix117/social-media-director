import { beforeEach, describe, expect, it, vi } from 'vitest'

const appSettingsRows = new Map<string, string>()
const operatorSettingsRows = new Map<
  string,
  {
    active_ai_backend_type: string | null
    openai_api_key_ciphertext: string | null
    openai_model: string | null
    codex_cli_model: string | null
    openai_verified_at: string | null
    codex_verified_at: string | null
  }
>()

vi.mock('../app/lib/server/session', () => ({
  readOperatorSession: async () => ({
    operatorId: 'operator-1',
    email: 'operator@example.com',
    firstName: 'Test',
    onboardingStepCompleted: 2,
    onboardingDismissed: false,
  }),
}))

vi.mock('../app/lib/server/codex-cli', () => ({
  getCodexCliStatus: async () => ({
    installed: true,
    authenticated: true,
    message: 'Logged in.',
  }),
}))

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(async (sql: string, params?: Array<string>) => {
      if (sql.includes('select key, value_ciphertext from app_settings')) {
        return {
          rows: Array.from(appSettingsRows.entries()).map(([key, value_ciphertext]) => ({
            key,
            value_ciphertext,
          })),
        }
      }

      if (sql.includes('delete from app_settings')) {
        appSettingsRows.delete(params![0]!)
        return { rows: [] }
      }

      if (sql.includes('insert into app_settings')) {
        appSettingsRows.set(params![0]!, params![1]!)
        return { rows: [] }
      }

      if (sql.includes('insert into operator_settings')) {
        const operatorId = params![0]!
        if (!operatorSettingsRows.has(operatorId)) {
          operatorSettingsRows.set(operatorId, {
            active_ai_backend_type: null,
            openai_api_key_ciphertext: null,
            openai_model: null,
            codex_cli_model: null,
            openai_verified_at: null,
            codex_verified_at: null,
          })
        }
        return { rows: [] }
      }

      if (sql.includes('from operator_settings') && sql.includes('where operator_id')) {
        const row = operatorSettingsRows.get(params![0]!)
        return { rows: row ? [{ ...row }] : [] }
      }

      if (sql.includes('update operator_settings')) {
        const operatorId = params![0]!
        const current = operatorSettingsRows.get(operatorId) ?? {
          active_ai_backend_type: null,
          openai_api_key_ciphertext: null,
          openai_model: null,
          codex_cli_model: null,
          openai_verified_at: null,
          codex_verified_at: null,
        }

        if (sql.includes('openai_api_key_ciphertext = coalesce')) {
          operatorSettingsRows.set(operatorId, {
            active_ai_backend_type:
              params![5] === null || params![5] === undefined
                ? current.active_ai_backend_type
                : (params![5] as string | null),
            openai_api_key_ciphertext: params![1] ?? current.openai_api_key_ciphertext,
            openai_model: params![2] ?? current.openai_model,
            codex_cli_model: current.codex_cli_model,
            openai_verified_at: params![3] ? new Date().toISOString() : current.openai_verified_at,
            codex_verified_at: current.codex_verified_at,
          })
        } else if (sql.includes('codex_cli_model = coalesce')) {
          operatorSettingsRows.set(operatorId, {
            active_ai_backend_type:
              params![3] === null || params![3] === undefined
                ? current.active_ai_backend_type
                : (params![3] as string | null),
            openai_api_key_ciphertext: current.openai_api_key_ciphertext,
            openai_model: current.openai_model,
            codex_cli_model: params![1] ?? current.codex_cli_model,
            openai_verified_at: current.openai_verified_at,
            codex_verified_at: params![2] ? new Date().toISOString() : current.codex_verified_at,
          })
        } else if (sql.includes('active_ai_backend_type = $2')) {
          operatorSettingsRows.set(operatorId, {
            ...current,
            active_ai_backend_type: params![1] ?? null,
          })
        } else if (sql.includes('case when $3::text is not null')) {
          operatorSettingsRows.set(operatorId, {
            active_ai_backend_type: params![1] ?? current.active_ai_backend_type,
            openai_api_key_ciphertext: params![2] ?? current.openai_api_key_ciphertext,
            openai_model: params![3] ?? current.openai_model,
            codex_cli_model: params![4] ?? current.codex_cli_model,
            openai_verified_at:
              params![2] && params![3] ? new Date().toISOString() : current.openai_verified_at,
            codex_verified_at: params![4] ? new Date().toISOString() : current.codex_verified_at,
          })
        }

        return { rows: [] }
      }

      if (sql.includes('where key = any')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    }),
  }),
}))

vi.mock('../app/lib/server/crypto', () => ({
  decryptSecret: (value: string) => value,
  encryptSecret: (value: string) => value,
}))

describe('settings persistence', () => {
  beforeEach(() => {
    appSettingsRows.clear()
    operatorSettingsRows.clear()
  })

  it('saves X refresh token and reports it as configured', async () => {
    const { getPublicSettingsStatus, saveAppSettings } = await import('../app/lib/server/settings')

    await saveAppSettings({
      xAccessToken: 'access-token',
      xRefreshToken: 'refresh-token',
    })

    await expect(getPublicSettingsStatus()).resolves.toMatchObject({
      xConfigured: true,
      xRefreshConfigured: true,
    })
  })

  it('saves Codex CLI credentials and reports the active backend as configured', async () => {
    const { getPublicSettingsStatus, saveOperatorAiConnection } = await import(
      '../app/lib/server/settings'
    )

    await saveOperatorAiConnection('operator-1', 'codexCli', {
      codexCliModel: 'gpt-5.1-codex',
      markVerified: true,
      setActiveIfUnset: true,
    })

    await expect(getPublicSettingsStatus()).resolves.toMatchObject({
      activeAiBackendType: 'codexCli',
      codexCliModel: 'gpt-5.1-codex',
      codexReady: true,
      configuredAiBackendTypes: ['codexCli'],
      modelConfigured: true,
    })
  })
})
