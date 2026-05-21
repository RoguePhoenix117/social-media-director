import type { PublishResult, SocialProviderAdapter } from '../domain/providers'
import { validateProviderPayload } from '../domain/validation'

export type LinkedInPublishOptions = {
  authorUrn: string
  apiVersion?: string
}

export function createLinkedInAdapter(options: LinkedInPublishOptions): SocialProviderAdapter {
  return {
    provider: 'linkedin',
    validate(payload) {
      return validateProviderPayload('linkedin', payload)
    },
    async publish(payload, accessToken) {
      const validation = this.validate(payload)
      if (validation.status === 'invalid') {
        throw new Error(validation.messages.join(' '))
      }

      const response = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'Linkedin-Version': options.apiVersion ?? '202604',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: options.authorUrn,
          commentary: payload.linkUrl && !payload.text.includes(payload.linkUrl)
            ? `${payload.text}\n\n${payload.linkUrl}`
            : payload.text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      })

      const rawText = await response.text()
      if (!response.ok) {
        throw new Error(rawText || response.statusText)
      }

      const id = response.headers.get('x-restli-id')
      if (!id) throw new Error('LinkedIn response did not include x-restli-id.')

      return {
        providerPostId: id,
        providerPostUrl: permalinkFor(id),
        rawResponse: rawText || { id },
      } satisfies PublishResult
    },
  }
}

function permalinkFor(id: string) {
  const encoded = encodeURIComponent(id)
  return `https://www.linkedin.com/feed/update/${encoded}`
}
