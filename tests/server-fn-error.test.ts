import { describe, expect, it } from 'vitest'
import {
  formatServerFunctionError,
  isStaleServerFunctionError,
} from '../app/lib/server-fn-error'

describe('server-fn-error', () => {
  it('detects stale TanStack Start server function IDs', () => {
    expect(
      isStaleServerFunctionError(new Error('Invalid server function ID: abc123')),
    ).toBe(true)
    expect(isStaleServerFunctionError(new Error('Network request failed'))).toBe(false)
  })

  it('formats stale server function errors for operators', () => {
    expect(
      formatServerFunctionError(new Error('Invalid server function ID: abc123')),
    ).toBe('The dev server reconnected. Refresh the page, then try again.')
  })
})
