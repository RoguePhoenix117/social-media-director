import type { Provider, PublishPayload, ValidationResult } from './providers'

const characterLimits: Record<Provider, number> = {
  x: 280,
  linkedin: 3000,
}

export function validateProviderPayload(
  provider: Provider,
  payload: PublishPayload,
): ValidationResult {
  const messages: string[] = []
  const text = payload.text.trim()

  if (!text) {
    messages.push('Post text is required.')
  }

  const limit = characterLimits[provider]
  if (text.length > limit) {
    messages.push(`${providerLabel(provider)} posts are limited to ${limit} characters.`)
  }

  if (payload.imageUrl && !isHttpUrl(payload.imageUrl)) {
    messages.push('Image URL must be an absolute HTTP or HTTPS URL.')
  }

  if (payload.linkUrl && !isHttpUrl(payload.linkUrl)) {
    messages.push('Link URL must be an absolute HTTP or HTTPS URL.')
  }

  return {
    status: messages.length > 0 ? 'invalid' : 'valid',
    messages,
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function providerLabel(provider: Provider) {
  if (provider === 'x') return 'X'
  return 'LinkedIn'
}
