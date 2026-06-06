import { createServerFn } from '@tanstack/react-start'
import {
  draftIdInputSchema,
  importDraftInputSchema,
  saveVariantEditsInputSchema,
} from '../lib/draft-schemas'
import { validateProviderPayload } from '../lib/domain/validation'
import type { Provider } from '../lib/domain/providers'
import {
  getDraft,
  listDrafts,
  markDraftReady as markDraftReadyInDb,
  saveImportedDraft,
  updateVariantTexts,
} from '../lib/db/repository'
import { logError, logInfo } from '../lib/server/logger'
import { listOperatorProjects, requireActiveProjectId } from '../lib/server/projects'
import { listPublicProjectChannels } from '../lib/server/provider-accounts'
import { getInstanceOAuthProviders } from '../lib/server/instance-config'
import { requireOperatorSession } from '../lib/server/session'
import {
  getAppSettings,
  getGenerationAiConfig,
  getPublicSettingsStatus,
} from '../lib/server/settings'

export const getDraftPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const projects = await listOperatorProjects(session.operatorId)
  const activeProjectId = session.activeProjectId
  const connectedChannels = activeProjectId
    ? await listPublicProjectChannels(activeProjectId)
    : []

  const [drafts, instanceOAuthProviders] = await Promise.all([
    activeProjectId ? listDrafts(activeProjectId) : Promise.resolve([]),
    getInstanceOAuthProviders(),
  ])

  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    activeProjectId,
    projects,
    connectedChannels,
    instanceOAuthProviders,
    settings: await getPublicSettingsStatus({ projectId: activeProjectId }),
    drafts,
  }
})

export const listProjectDrafts = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const projectId = await requireActiveProjectId(session)
  return listDrafts(projectId)
})

export const loadDraft = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => draftIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    const draft = await getDraft(data.masterPostId, projectId)
    if (!draft) throw new Error('Draft not found.')
    const connectedChannels = await listPublicProjectChannels(projectId)
    return {
      draft,
      connectedProviders: connectedChannels.map((channel) => channel.provider),
    }
  })

export const importAndGenerate = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => importDraftInputSchema.parse(input))
  .handler(async ({ data }) => {
    const startedAt = Date.now()
    try {
      const session = await requireOperatorSession()
      const projectId = await requireActiveProjectId(session)

      const connectedChannels = await listPublicProjectChannels(projectId)
      const targetProviders = connectedChannels.map(
        (channel) => channel.provider,
      ) as Provider[]

      if (!targetProviders.length) {
        throw new Error('Connect at least one channel in Settings before generating drafts.')
      }

      logInfo('import_generate.start', {
        url: data.url,
        hasIntentPrompt: Boolean(data.intentPrompt?.trim()),
        projectId,
        targetProviders: targetProviders.join(','),
      })

      const settings = await getAppSettings()
      const generationConfig = {
        ...(getGenerationAiConfig(settings) ?? {}),
        targetProviders,
      }
      const { importPublicBlogUrl } = await import('../lib/import/public-url')
      const source = await importPublicBlogUrl(data.url)
      const { generateSocialPosts } = await import('../lib/ai/generate-variants')
      const generation = await generateSocialPosts(
        { source, intentPrompt: data.intentPrompt },
        generationConfig,
      )
      const variants = generation.variants

      const mappedVariants = variants.map((variant) => ({
        ...variant,
        validation: validateProviderPayload(variant.provider, variant),
      }))

      const masterPostId = await saveImportedDraft(source, variants, {
        intentPrompt: data.intentPrompt,
        projectId,
        generationMetadata: generation.metadata,
      })

      logInfo('import_generate.success', {
        durationMs: Date.now() - startedAt,
        variantCount: variants.length,
        projectId,
        masterPostId,
      })

      return {
        masterPostId,
        source,
        variants: mappedVariants,
      }
    } catch (error) {
      logError('import_generate.failure', error, {
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  })

export const saveVariantEdits = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveVariantEditsInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    const connectedChannels = await listPublicProjectChannels(projectId)
    const connectedProviders = connectedChannels.map(
      (channel) => channel.provider,
    ) as Provider[]

    const draft = await updateVariantTexts(
      data.masterPostId,
      projectId,
      data.variants,
      connectedProviders,
    )

    return { draft }
  })

export const markDraftReady = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => draftIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    const connectedChannels = await listPublicProjectChannels(projectId)
    const connectedProviders = connectedChannels.map(
      (channel) => channel.provider,
    ) as Provider[]

    const draft = await markDraftReadyInDb(data.masterPostId, projectId, connectedProviders)
    return { draft }
  })

export type ImportResult = Awaited<ReturnType<typeof importAndGenerate>>
