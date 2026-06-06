import {
  getDraft,
  markMasterPostPublished,
  recordPublishAttempt,
} from '../db/repository'
import type { Provider } from '../domain/providers'
import { getProviderAdapter } from '../providers'
import { decryptSecret } from './crypto'
import { logInfo } from './logger'
import { getProjectChannel } from './provider-accounts'

export async function publishToProvider(input: {
  provider: Provider
  projectId: string
  providerAccountId: string
  providerVariantId: string | null
  payload: { text: string; linkUrl?: string; imageUrl?: string }
  linkedinAuthorUrn?: string
  accessTokenCiphertext: string
}) {
  const adapter = getProviderAdapter(input.provider, {
    linkedinAuthorUrn: input.linkedinAuthorUrn,
    linkedinApiVersion: undefined,
  })

  if (input.provider === 'linkedin' && !input.linkedinAuthorUrn) {
    throw new Error('LinkedIn channel is missing the author URN. Reconnect LinkedIn.')
  }

  const token = decryptSecret(input.accessTokenCiphertext)

  try {
    const result = await adapter.publish(input.payload, token)

    if (input.providerVariantId) {
      await recordPublishAttempt({
        providerVariantId: input.providerVariantId,
        providerAccountId: input.providerAccountId,
        status: 'published',
        providerPostId: result.providerPostId,
        providerPostUrl: result.providerPostUrl,
        providerResponse: result.rawResponse,
      })
    }

    logInfo('publish.success', {
      provider: input.provider,
      projectId: input.projectId,
      providerPostId: result.providerPostId,
    })

    return {
      providerPostId: result.providerPostId,
      providerPostUrl: result.providerPostUrl,
    }
  } catch (error) {
    if (input.providerVariantId) {
      await recordPublishAttempt({
        providerVariantId: input.providerVariantId,
        providerAccountId: input.providerAccountId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Publish failed.',
      })
    }
    throw error
  }
}

export async function publishMasterPostForSchedule(
  masterPostId: string,
  projectId: string,
): Promise<void> {
  const draft = await getDraft(masterPostId, projectId)
  if (!draft) throw new Error('Draft not found.')

  for (const variant of draft.variants) {
    const channel = await getProjectChannel(projectId, variant.provider)
    if (!channel) continue

    await publishToProvider({
      provider: variant.provider,
      projectId,
      providerAccountId: channel.id,
      providerVariantId: variant.id,
      payload: {
        text: variant.text,
        linkUrl: variant.linkUrl ?? undefined,
        imageUrl: variant.imageUrl ?? undefined,
      },
      linkedinAuthorUrn: channel.authorUrn ?? undefined,
      accessTokenCiphertext: channel.accessTokenCiphertext,
    })
  }

  await markMasterPostPublished(masterPostId, projectId)
}
