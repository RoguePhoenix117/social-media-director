import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
}))

const instanceMetaRow = {
  configured: false,
  setup_completed_at: null as string | null,
}

const writeOAuthCredentialsToEnv = vi.fn(async () => ({
  envFilePath: '/tmp/.env',
  updatedKeys: ['X_CLIENT_ID'],
  createdFile: false,
}))

vi.mock('../app/lib/server/oauth-env-writer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/lib/server/oauth-env-writer')>()
  return {
    ...actual,
    writeOAuthCredentialsToEnv,
  }
})

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(async (sql: string) => {
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
    instanceMetaRow.configured = false
    instanceMetaRow.setup_completed_at = null
    clearOAuthEnv()
    writeOAuthCredentialsToEnv.mockClear()
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readFileSync).mockReset()
  })

  afterEach(() => {
    restoreOAuthEnv()
  })

  it('returns null providers when env vars are unset', async () => {
    const { getInstanceOAuthConfig, isInstanceConfigured } = await import(
      '../app/lib/server/instance-config'
    )

    await expect(getInstanceOAuthConfig()).resolves.toEqual({ x: null, linkedin: null })
    await expect(isInstanceConfigured()).resolves.toBe(false)
  })

  it('reads OAuth credentials from environment variables', async () => {
    process.env.X_CLIENT_ID = 'env-x-id'
    process.env.X_CLIENT_SECRET = 'env-x-secret'

    const { getInstanceOAuthConfig } = await import('../app/lib/server/instance-config')

    const config = await getInstanceOAuthConfig()
    expect(config.x).toEqual({
      clientId: 'env-x-id',
      clientSecret: 'env-x-secret',
      source: 'env',
    })
  })

  it('falls back to the project .env file when process.env is unset', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(
      'X_CLIENT_ID=file-x-id\nX_CLIENT_SECRET=file-x-secret\n',
    )

    const { getInstanceOAuthConfig, getInstanceOAuthProviders } = await import(
      '../app/lib/server/instance-config'
    )

    const config = await getInstanceOAuthConfig()
    expect(config.x).toEqual({
      clientId: 'file-x-id',
      clientSecret: 'file-x-secret',
      source: 'env',
    })
    await expect(getInstanceOAuthProviders()).resolves.toEqual({ x: true, linkedin: false })
  })

  it('prefers process.env over the .env file when both are set', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(
      'X_CLIENT_ID=file-x-id\nX_CLIENT_SECRET=file-x-secret\n',
    )
    process.env.X_CLIENT_ID = 'runtime-x-id'
    process.env.X_CLIENT_SECRET = 'runtime-x-secret'

    const { getInstanceOAuthConfig } = await import('../app/lib/server/instance-config')

    const config = await getInstanceOAuthConfig()
    expect(config.x?.clientId).toBe('runtime-x-id')
    expect(config.x?.clientSecret).toBe('runtime-x-secret')
  })

  it('treats the instance as configured when env supplies only X creds', async () => {
    const { isInstanceConfigured } = await import('../app/lib/server/instance-config')

    process.env.X_CLIENT_ID = 'env-x-id'
    process.env.X_CLIENT_SECRET = 'env-x-secret'

    await expect(isInstanceConfigured()).resolves.toBe(true)
  })

  it('treats the instance as configured after setup completes with zero providers', async () => {
    const { isInstanceConfigured, markInstanceConfigured } = await import(
      '../app/lib/server/instance-config'
    )

    await markInstanceConfigured()
    await expect(isInstanceConfigured()).resolves.toBe(true)
  })

  it('writes credentials to .env instead of Postgres', async () => {
    const { saveInstanceOAuthCredentials } = await import('../app/lib/server/instance-config')

    await saveInstanceOAuthCredentials({
      xClientId: 'x-id',
      xClientSecret: 'x-secret',
    })

    expect(writeOAuthCredentialsToEnv).toHaveBeenCalledWith({
      X_CLIENT_ID: 'x-id',
      X_CLIENT_SECRET: 'x-secret',
    })
  })

  it('omits blank secrets from env updates', async () => {
    const { saveInstanceOAuthCredentials } = await import('../app/lib/server/instance-config')

    await saveInstanceOAuthCredentials({
      xClientId: 'updated-id',
      xClientSecret: '   ',
    })

    expect(writeOAuthCredentialsToEnv).toHaveBeenCalledWith({
      X_CLIENT_ID: 'updated-id',
    })
  })
})
