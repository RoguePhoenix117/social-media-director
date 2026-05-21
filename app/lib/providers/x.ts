import type { PublishResult, SocialProviderAdapter } from '../domain/providers'
import { validateProviderPayload } from '../domain/validation'

export const xAdapter: SocialProviderAdapter = {
  provider: 'x',
  validate(payload) {
    return validateProviderPayload('x', payload)
  },
  async publish(payload, accessToken) {
    const validation = this.validate(payload)
    if (validation.status === 'invalid') {
      throw new Error(validation.messages.join(' '))
    }

    const text = payload.linkUrl && !payload.text.includes(payload.linkUrl)
      ? `${payload.text}\n${payload.linkUrl}`
      : payload.text

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    const rawResponse = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(providerError(rawResponse, response.statusText))
    }

    const id = String((rawResponse as { data?: { id?: string } }).data?.id ?? '')
    if (!id) throw new Error('X response did not include a post id.')

    return {
      providerPostId: id,
      providerPostUrl: `https://x.com/i/web/status/${id}`,
      rawResponse,
    } satisfies PublishResult
  },
}

function providerError(rawResponse: unknown, fallback: string) {
  const errors = (rawResponse as { errors?: Array<{ detail?: string; title?: string }> }).errors
  return errors?.map((error) => error.detail ?? error.title).filter(Boolean).join(' ') || fallback
}
