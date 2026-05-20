import { describe, expect, it } from 'vitest'
import { isDatabaseConnectionError } from '../app/lib/db/errors'

describe('isDatabaseConnectionError', () => {
  it('recognizes Postgres connection refused errors', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    })

    expect(isDatabaseConnectionError(error)).toBe(true)
  })

  it('does not treat ordinary app errors as database connection errors', () => {
    expect(isDatabaseConnectionError(new Error('Invalid email or password.'))).toBe(false)
  })
})
