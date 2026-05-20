import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { TemplatePostPage } from '../components/template-pages'
import { generateSocialPosts } from '../lib/ai/generate-variants'
import type { Provider } from '../lib/domain/providers'
import { validateProviderPayload } from '../lib/domain/validation'
import { importPublicBlogUrl } from '../lib/import/public-url'
import { logError, logInfo } from '../lib/server/logger'
import { requireOperatorSession } from '../lib/server/session'
import { getAppSettings, getPublicSettingsStatus } from '../lib/server/settings'

const promptGenerationInputSchema = z.object({
  prompt: z.string().min(1, 'Enter a prompt or URL before generating.'),
})

const getPostPageSettings = createServerFn({ method: 'GET' }).handler(async () => {
  return getPublicSettingsStatus()
})

const generatePostDrafts = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => promptGenerationInputSchema.parse(input))
  .handler(async ({ data }) => {
    const startedAt = Date.now()
    await requireOperatorSession()
    const prompt = data.prompt.trim()
    const sourceUrl = extractFirstUrl(prompt)
    const intentPrompt = sourceUrl ? prompt.replace(sourceUrl, '').trim() : prompt

    try {
      logInfo('post_prompt_generate.start', {
        hasSourceUrl: Boolean(sourceUrl),
        hasIntentPrompt: Boolean(intentPrompt),
      })
      const settings = await getAppSettings()
      const publicSettings = await getPublicSettingsStatus()
      const targetProviders = getPostGenerationProviders(publicSettings)
      const source = sourceUrl
        ? await importPublicBlogUrl(sourceUrl)
        : {
            sourceType: 'public_url' as const,
            sourceUrl: 'manual-prompt',
            canonicalUrl: '',
            title: 'Manual prompt',
            description: prompt,
            excerpt: prompt,
            body: prompt,
          }
      const result = await generateSocialPosts(
        {
          source,
          intentPrompt,
        },
        {
          aiProvider: settings.aiProvider,
          openaiApiKey: settings.openaiApiKey,
          openaiModel: settings.openaiModel,
          codexCliModel: settings.codexCliModel,
          targetProviders,
        },
      )

      logInfo('post_prompt_generate.success', {
        durationMs: Date.now() - startedAt,
        targetProviders: targetProviders.join(','),
        variantCount: result.variants.length,
      })

      return {
        masterPost: source.canonicalUrl ? result.masterPost : removeEmptyReadMore(result.masterPost),
        sourceTitle: source.title,
        variants: result.variants.map((variant) => {
          const text = source.canonicalUrl ? variant.text : removeEmptyReadMore(variant.text)
          return {
            ...variant,
            text,
            validation: validateProviderPayload(variant.provider, {
              ...variant,
              text,
            }),
          }
        }),
      }
    } catch (error) {
      logError('post_prompt_generate.failure', error, {
        durationMs: Date.now() - startedAt,
        hasSourceUrl: Boolean(sourceUrl),
      })
      throw error
    }
  })

export const Route = createFileRoute('/post')({
  loader: () => getPostPageSettings(),
  component: PostRouteComponent,
})

function PostRouteComponent() {
  const settings = Route.useLoaderData()
  const generatePostDraftsFn = useServerFn(generatePostDrafts)
  return (
    <TemplatePostPage
      settings={settings}
      onGenerate={async (prompt) => generatePostDraftsFn({ data: { prompt } })}
    />
  )
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s)]+/)?.[0]
}

function removeEmptyReadMore(value: string) {
  return value
    .replace(/\n\nRead more:\s*$/i, '')
    .replace(/\n\n$/g, '')
}

function getPostGenerationProviders(settings: {
  xConfigured: boolean
  linkedinConfigured: boolean
}): Provider[] {
  const configuredProviders = [
    settings.xConfigured ? 'x' : undefined,
    settings.linkedinConfigured ? 'linkedin' : undefined,
  ].filter((provider): provider is Provider => Boolean(provider))

  return configuredProviders.length ? configuredProviders : ['x', 'linkedin']
}
