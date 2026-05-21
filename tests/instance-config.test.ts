import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const instanceConfigRows = new Map<string, string>()
const instanceMetaRow = {
  configured: false,
  setup_completed_at: null as string | null,
}

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(async (sql: string, params?: Array<unknown>) => {
      if (sql.includes('select key, value_ciphertext from instance_config')) {
        return {
          rows: Array.from(instanceConfigRows.entries()).map(([key, value_ciphertext]) => ({
            key,
            value_ciphertext,
          })),
        }
      }

      if (sql.includes('delete from instance_config')) {
        instanceConfigRows.delete(params![0] as string)
        return { rows: [] }
      }

      if (sql.includes('insert into instance_config')) {
        instanceConfigRows.set(params![0] as string, params![1] as string)
        return { rows: [] }
      }

      if (sql.includes('select configured, setup_completed_at from instance_meta')) {
        return { rows: [instanceMetaRow] }
      }

      if (sql.includes('update instance_meta')) {
        instanceMetaRow.configured = true
        if (!instanceMetaRow.setup_completed_at) {
          instanceMetaRow.setup_completed_at = new Date().toISOString()
        }
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    }),
  }),
}))

vi.mock('../app/lib/server/crypto', () => ({
  encryptSecret: (value: string) => `enc:${value}`,
  decryptSecret: (value: string) => value.replace(/^enc:/, ''),
}))

const originalEnv = {
  X_CLIENT_ID: process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
}

function clearOAuthEnv() {
  delete process.env.X_CLIENT_ID
  delete process.env.X_CLIENT_SECRET
  delete process.env.LINKEDIN_CLIENT_ID
  delete process.env.LINKEDIN_CLIENT_SECRET
}

function restoreOAuthEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key as keyof typeof originalEnv]
    } else {
      process.env[key as keyof typeof originalEnv] = value
    }
  }
}

describe('instance config', () => {
  beforeEach(() => {
    instanceConfigRows.clear()
    instanceMetaRow.configured = false
    instanceMetaRow.setup_completed_at = null
    clearOAuthEnv()
  })

  afterEach(() => {
    restoreOAuthEnv()
  })

  it('returns null providers when nothing is configured', async () => {
    const { getInstanceOAuthConfig, isInstanceConfigured } = await import(
      '../app/lib/server/instance-config'
    )

    await expect(getInstanceOAuthConfig()).resolves.toEqual({ x: null, linkedin: null })
    await expect(isInstanceConfigured()).resolves.toBe(false)
  })

  it('round-trips DB-stored OAuth credentials encrypted', async () => {
    const { getInstanceOAuthConfig, saveInstanceOAuthConfig } = await import(
      '../app/lib/server/instance-config'
    )

    await saveInstanceOAuthConfig({
      xClientId: 'x-id',
      xClientSecret: 'x-secret',
      linkedinClientId: 'li-id',
      linkedinClientSecret: 'li-secret',
    })

    for (const value of instanceConfigRows.values()) {
      expect(value.startsWith('enc:')).toBe(true)
    }

    const config = await getInstanceOAuthConfig()
    expect(config.x).toEqual({ clientId: 'x-id', clientSecret: 'x-secret', source: 'db' })
    expect(config.linkedin).toEqual({
      clientId: 'li-id',
      clientSecret: 'li-secret',
      source: 'db',
    })
  })

  it('lets env vars override DB-stored OAuth credentials', async () => {
    const { getInstanceOAuthConfig, saveInstanceOAuthConfig } = await import(
      '../app/lib/server/instance-config'
    )

    await saveInstanceOAuthConfig({
      xClientId: 'db-x-id',
      xClientSecret: 'db-x-secret',
    })

    process.env.X_CLIENT_ID = 'env-x-id'
    process.env.X_CLIENT_SECRET = 'env-x-secret'

    const config = await getInstanceOAuthConfig()
    expect(config.x).toEqual({
      clientId: 'env-x-id',
      clientSecret: 'env-x-secret',
      source: 'env',
    })
  })

  it('treats the instance as configured when env supplies all four creds', async () => {
    const { isInstanceConfigured } = await import('../app/lib/server/instance-config')

    process.env.X_CLIENT_ID = 'env-x-id'
    process.env.X_CLIENT_SECRET = 'env-x-secret'
    process.env.LINKEDIN_CLIENT_ID = 'env-li-id'
    process.env.LINKEDIN_CLIENT_SECRET = 'env-li-secret'

    await expect(isInstanceConfigured()).resolves.toBe(true)
  })

  it('requires markInstanceConfigured when only DB creds are present', async () => {
    const { isInstanceConfigured, markInstanceConfigured, saveInstanceOAuthConfig } = await import(
      '../app/lib/server/instance-config'
    )

    await saveInstanceOAuthConfig({
      xClientId: 'db-x-id',
      xClientSecret: 'db-x-secret',
      linkedinClientId: 'db-li-id',
      linkedinClientSecret: 'db-li-secret',
    })

    await expect(isInstanceConfigured()).resolves.toBe(false)
    await markInstanceConfigured()
    await expect(isInstanceConfigured()).resolves.toBe(true)
  })

  it('deletes a key when the saved value is empty', async () => {
    const { saveInstanceOAuthConfig } = await import('../app/lib/server/instance-config')

    await saveInstanceOAuthConfig({
      xClientId: 'db-x-id',
      xClientSecret: 'db-x-secret',
    })
    expect(instanceConfigRows.size).toBe(2)

    await saveInstanceOAuthConfig({
      xClientId: '',
    })
    expect(instanceConfigRows.has('x_client_id')).toBe(false)
    expect(instanceConfigRows.has('x_client_secret')).toBe(true)
  })
})
