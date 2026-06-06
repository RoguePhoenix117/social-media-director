import { createServerFn } from '@tanstack/react-start'
import { publishInputSchema } from '../lib/dashboard-schemas'
import { draftIdInputSchema } from '../lib/draft-schemas'
import { getDraft, markMasterPostPublished } from '../lib/db/repository'
import type { Provider } from '../lib/domain/providers'
import { publishToProvider } from '../lib/server/publish-service'
import { logError } from '../lib/server/logger'
import { requireActiveProjectId } from '../lib/server/projects'
import { getProjectChannel } from '../lib/server/provider-accounts'
import { requireOperatorSession } from '../lib/server/session'

export const publishVariant = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const activeProjectId = await requireActiveProjectId(session)

    const channel = await getProjectChannel(activeProjectId, data.provider)
    if (!channel) {
      const label = data.provider === 'linkedin' ? 'LinkedIn' : 'X'
      throw new Error(
        `${label} is not connected for this project. Open the Connect Channels modal first.`,
      )
    }

    const result = await publishToProvider({
      provider: data.provider,
      projectId: activeProjectId,
      providerAccountId: channel.id,
      providerVariantId: null,
      payload: data,
      linkedinAuthorUrn: channel.authorUrn ?? undefined,
      accessTokenCiphertext: channel.accessTokenCiphertext,
    })

    return result
  })

export const publishDraftNow = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => draftIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    const draft = await getDraft(data.masterPostId, projectId)

    if (!draft) throw new Error('Draft not found.')
    if (draft.status !== 'ready' && draft.status !== 'published') {
      throw new Error('Only ready drafts can be published.')
    }

    const results: Array<{
      provider: Provider
      providerPostId: string
      providerPostUrl?: string
    }> = []

    for (const variant of draft.variants) {
      const channel = await getProjectChannel(projectId, variant.provider)
      if (!channel) continue

      try {
        const result = await publishToProvider({
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
        results.push({
          provider: variant.provider,
          providerPostId: result.providerPostId,
          providerPostUrl: result.providerPostUrl,
        })
      } catch (error) {
        logError('publish_draft.variant_failed', error, {
          masterPostId: data.masterPostId,
          provider: variant.provider,
        })
        throw error
      }
    }

    if (!results.length) {
      throw new Error('No connected channels matched this draft.')
    }

    await markMasterPostPublished(data.masterPostId, projectId)

    return { results }
  })
