import { describe, expect, it } from 'vitest'
import { OperatorAuthError, isOperatorAuthError } from '../app/lib/auth-errors'

describe('operator auth errors', () => {
  it('detects OperatorAuthError instances', () => {
    expect(isOperatorAuthError(new OperatorAuthError())).toBe(true)
  })

  it('detects legacy Unauthorized messages', () => {
    expect(isOperatorAuthError(new Error('Unauthorized'))).toBe(true)
  })
})
