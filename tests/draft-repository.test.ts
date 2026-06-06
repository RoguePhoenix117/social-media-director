import { describe, expect, it } from 'vitest'
import { validateProviderPayload } from '../app/lib/domain/validation'

describe('draft ready validation', () => {
  it('requires valid text for each connected provider', () => {
    const xValid = validateProviderPayload('x', { text: 'Hello world' })
    const xInvalid = validateProviderPayload('x', { text: '' })
    expect(xValid.status).toBe('valid')
    expect(xInvalid.status).toBe('invalid')
  })
})
