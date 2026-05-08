import type {
  ImportedContentSource,
  MasterPostInput,
  ProviderVariant,
} from '../domain/providers'

export async function generateProviderVariants(
  input: MasterPostInput,
  modelConfig?: { openaiApiKey?: string; openaiModel?: string },
): Promise<ProviderVariant[]> {
  const apiKey = modelConfig?.openaiApiKey ?? process.env.OPENAI_API_KEY
  if (apiKey) {
    return generateWithOpenAI(input, {
      apiKey,
      model: modelConfig?.openaiModel ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    })
  }

  return generateFallbackVariants(input.source, input.intentPrompt)
}

function generateFallbackVariants(
  source: ImportedContentSource,
  intentPrompt?: string,
): ProviderVariant[] {
  const hook = intentPrompt?.trim() || source.description || source.excerpt || source.title
  const shortHook = trimToLength(hook, 180)
  const longHook = trimToLength(hook, 900)

  return [
    {
      provider: 'x',
      text: trimToLength(`${shortHook}\n\n${source.canonicalUrl}`, 280),
      linkUrl: source.canonicalUrl,
      imageUrl: source.imageUrl,
    },
    {
      provider: 'linkedin',
      text: trimToLength(
        `${source.title}\n\n${longHook}\n\nRead more: ${source.canonicalUrl}`,
        3000,
      ),
      linkUrl: source.canonicalUrl,
      imageUrl: source.imageUrl,
    },
  ]
}

async function generateWithOpenAI(
  input: MasterPostInput,
  config: { apiKey: string; model: string },
): Promise<ProviderVariant[]> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: 'system',
          content:
            'Generate reviewed social media drafts from blog posts. Return strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Create one X draft and one LinkedIn draft. Include the canonical URL.',
            schema: {
              variants: [
                {
                  provider: 'x or linkedin',
                  text: 'string',
                  linkUrl: 'string',
                  imageUrl: 'string optional',
                },
              ],
            },
            input,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI generation failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { output_text?: string }
  const parsed = JSON.parse(data.output_text ?? '{}') as { variants?: ProviderVariant[] }

  if (!parsed.variants?.length) {
    throw new Error('AI response did not include provider variants.')
  }

  return parsed.variants.map((variant) => ({
    ...variant,
    linkUrl: variant.linkUrl || input.source.canonicalUrl,
    imageUrl: variant.imageUrl || input.source.imageUrl,
  }))
}

function trimToLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trim()}...`
}
