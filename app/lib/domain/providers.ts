export const providers = ['x', 'linkedin'] as const

export type Provider = (typeof providers)[number]

export type ImportedContentSource = {
  sourceType: 'public_url'
  sourceUrl: string
  canonicalUrl: string
  title: string
  description?: string
  imageUrl?: string
  excerpt?: string
  body?: string
}

export type MasterPostInput = {
  source: ImportedContentSource
  intentPrompt?: string
}

export type ProviderVariant = {
  provider: Provider
  text: string
  linkUrl?: string
  imageUrl?: string
}

export type ValidationResult = {
  status: 'valid' | 'warning' | 'invalid'
  messages: string[]
}

export type PublishPayload = {
  text: string
  linkUrl?: string
  imageUrl?: string
}

export type PublishResult = {
  providerPostId: string
  providerPostUrl?: string
  rawResponse: unknown
}

export interface SocialProviderAdapter {
  provider: Provider
  validate(payload: PublishPayload): ValidationResult
  publish(payload: PublishPayload, accessToken: string): Promise<PublishResult>
}
