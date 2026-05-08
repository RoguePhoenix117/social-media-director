import type { Provider, SocialProviderAdapter } from '../domain/providers'
import { createLinkedInAdapter } from './linkedin'
import { xAdapter } from './x'

export function getProviderAdapter(
  provider: Provider,
  options?: { linkedinAuthorUrn?: string; linkedinApiVersion?: string },
): SocialProviderAdapter {
  if (provider === 'x') return xAdapter
  return createLinkedInAdapter({
    authorUrn: options?.linkedinAuthorUrn ?? process.env.LINKEDIN_AUTHOR_URN ?? '',
    apiVersion: options?.linkedinApiVersion ?? process.env.LINKEDIN_API_VERSION,
  })
}
