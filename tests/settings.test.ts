import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows = new Map<string, string>()

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(async (sql: string, params?: Array<string>) => {
      if (sql.includes('select key, value_ciphertext from app_settings')) {
        return {
          rows: Array.from(rows.entries()).map(([key, value_ciphertext]) => ({
            key,
            value_ciphertext,
          })),
        }
      }

      if (sql.includes('delete from app_settings')) {
        rows.delete(params![0]!)
        return { rows: [] }
      }

      if (sql.includes('insert into app_settings')) {
        rows.set(params![0]!, params![1]!)
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
    rows.clear()
  })

  it('saves Codex CLI as the selected AI provider and reports it as configured', async () => {
    const { getPublicSettingsStatus, saveAppSettings } = await import('../app/lib/server/settings')

    await saveAppSettings({
      aiProvider: 'codexCli',
      codexCliModel: 'gpt-5.1-codex',
      openaiModel: 'gpt-4.1-mini',
    })

    await expect(getPublicSettingsStatus()).resolves.toMatchObject({
      aiProvider: 'codexCli',
      codexCliEnabled: true,
      codexCliModel: 'gpt-5.1-codex',
      modelConfigured: true,
    })
  })
})
