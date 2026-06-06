import type { Provider } from '../domain/providers'
import type { GenerationMetadata } from '../ai/generate-variants'

export type MasterPostStatus = 'draft' | 'ready' | 'published'

export type ScheduledPostStatus =
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'cancelled'
  | 'failed'

export type ScheduledPostItem = {
  id: string
  masterPostId: string
  scheduledAt: string
  timezone: string
  status: ScheduledPostStatus
  summary: string
  errorMessage: string | null
}

export type DraftCounts = {
  draft: number
  ready: number
  published: number
  total: number
}

export type DraftListItem = {
  id: string
  status: MasterPostStatus
  summary: string
  sourceTitle: string | null
  sourceUrl: string | null
  createdAt: string
  updatedAt: string
}

export type DraftVariantRow = {
  id: string
  provider: Provider
  text: string
  linkUrl: string | null
  imageUrl: string | null
  validationStatus: 'valid' | 'warning' | 'invalid'
  validationMessages: string[]
}

export type DraftDetail = {
  id: string
  status: MasterPostStatus
  intentPrompt: string | null
  summary: string
  generationMetadata: GenerationMetadata | null
  source: {
    title: string
    canonicalUrl: string
    excerpt: string | null
    imageUrl: string | null
    sourceUrl: string
  } | null
  variants: DraftVariantRow[]
  createdAt: string
  updatedAt: string
}
