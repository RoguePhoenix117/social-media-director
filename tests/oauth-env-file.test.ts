import { describe, expect, it } from 'vitest'
import {
  mergeOAuthEnvContent,
  readOAuthVarsFromEnvContent,
  formatEnvValue,
} from '../app/lib/oauth-env-file'

describe('mergeOAuthEnvContent', () => {
  it('updates existing OAuth keys without touching other lines', () => {
    const input = `# header
DATABASE_URL=postgres://localhost/db
X_CLIENT_ID=old-x
X_CLIENT_SECRET=old-secret
OPENAI_API_KEY=keep-me
`

    const result = mergeOAuthEnvContent(input, {
      X_CLIENT_ID: 'new-x-id',
      X_CLIENT_SECRET: 'new-x-secret',
    })

    expect(result).toContain('DATABASE_URL=postgres://localhost/db')
    expect(result).toContain('X_CLIENT_ID=new-x-id')
    expect(result).toContain('X_CLIENT_SECRET=new-x-secret')
    expect(result).toContain('OPENAI_API_KEY=keep-me')
    expect(result).not.toContain('old-x')
    expect(result).toMatch(/^# header/m)
  })

  it('appends OAuth keys that are missing from the file', () => {
    const input = 'SESSION_SECRET=abc\n'

    const result = mergeOAuthEnvContent(input, {
      LINKEDIN_CLIENT_ID: 'li-id',
      LINKEDIN_CLIENT_SECRET: 'li-secret',
    })

    expect(result).toContain('SESSION_SECRET=abc')
    expect(result).toContain('LINKEDIN_CLIENT_ID=li-id')
    expect(result).toContain('LINKEDIN_CLIENT_SECRET=li-secret')
  })

  it('removes a key when the update value is empty', () => {
    const input = 'X_CLIENT_ID=remove-me\nSESSION_SECRET=abc\n'

    const result = mergeOAuthEnvContent(input, {
      X_CLIENT_ID: '',
    })

    expect(result).not.toContain('X_CLIENT_ID=')
    expect(result).toContain('SESSION_SECRET=abc')
  })

  it('quotes values with spaces or special characters', () => {
    const result = mergeOAuthEnvContent('', {
      X_CLIENT_SECRET: 'has spaces',
    })

    expect(result).toBe('X_CLIENT_SECRET="has spaces"\n')
  })

  it('leaves unspecified keys unchanged', () => {
    const input = 'X_CLIENT_ID=keep\nX_CLIENT_SECRET=keep-secret\n'

    const result = mergeOAuthEnvContent(input, {
      X_CLIENT_ID: 'updated-only-id',
    })

    expect(result).toContain('X_CLIENT_ID=updated-only-id')
    expect(result).toContain('X_CLIENT_SECRET=keep-secret')
  })
})

describe('readOAuthVarsFromEnvContent', () => {
  it('parses quoted and unquoted values', () => {
    const values = readOAuthVarsFromEnvContent(`
X_CLIENT_ID=plain
X_CLIENT_SECRET="quoted secret"
LINKEDIN_CLIENT_ID='single'
`)

    expect(values).toEqual({
      X_CLIENT_ID: 'plain',
      X_CLIENT_SECRET: 'quoted secret',
      LINKEDIN_CLIENT_ID: 'single',
    })
  })
})

describe('formatEnvValue', () => {
  it('leaves simple tokens unquoted', () => {
    expect(formatEnvValue('abc123_-.:/+')).toBe('abc123_-.:/+')
  })
})
