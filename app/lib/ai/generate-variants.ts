import { chat, type ChatMiddleware, type TokenUsage } from '@tanstack/ai'
import {
  createOpenaiChat,
  OPENAI_CHAT_MODELS,
  type OpenAIChatModel,
} from '@tanstack/ai-openai'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { createOllamaChat } from '@tanstack/ai-ollama'
import { z } from 'zod'
import { DEFAULT_OPENAI_SOCIAL_MODEL } from './recommended-models'
import { DEFAULT_OPENAI_COMPATIBLE_API_KEY, DEFAULT_OLLAMA_HOST } from '../server/local-ai-models'
import type {
  ImportedContentSource,
  MasterPostInput,
  Provider,
  ProviderVariant,
} from '../domain/providers'
import { providers } from '../domain/providers'
import { logError, logInfo } from '../server/logger'

const generatedSocialPostsSchema = z.object({
  masterPost: z
    .string()
    .meta({ description: 'A reusable master social post that can be adapted for any platform.' }),
  variants: z
    .array(
      z.object({
        provider: z.enum(providers),
        text: z.string().meta({ description: 'The platform-specific social media post.' }),
        linkUrl: z.string().nullable().meta({
          description: 'Canonical URL to attach or include. Use null when none.',
        }),
        imageUrl: z.string().nullable().meta({
          description: 'Optional image URL. Use null when unavailable.',
        }),
      }),
    )
    .meta({ description: 'One tailored social post for each requested platform.' }),
})

export type GeneratedSocialPosts = {
  masterPost: string
  variants: ProviderVariant[]
  metadata: GenerationMetadata
}

type GeneratedSocialPostsPayload = Omit<GeneratedSocialPosts, 'metadata'>

type GenerationConfig = {
  aiProvider?: 'template' | 'openaiApiKey' | 'ollama' | 'openaiCompatible' | 'codexCli'
  openaiApiKey?: string
  openaiModel?: string
  ollamaHost?: string
  ollamaModel?: string
  openaiCompatibleProviderName?: string
  openaiCompatibleBaseUrl?: string
  openaiCompatibleApiKey?: string
  openaiCompatibleModel?: string
  codexCliModel?: string
  targetProviders?: Provider[]
}

export type GenerationMetadata = {
  mode: 'ai' | 'template'
  backend: 'template' | 'openaiApiKey' | 'ollama' | 'openaiCompatible' | 'codexCli'
  model?: string
  providerName?: string
  durationMs: number
  usage?: TokenUsage
}

export async function generateProviderVariants(
  input: MasterPostInput,
  modelConfig?: GenerationConfig,
): Promise<ProviderVariant[]> {
  const result = await generateSocialPosts(input, modelConfig)
  return result.variants
}

export async function generateSocialPosts(
  input: MasterPostInput,
  modelConfig?: GenerationConfig,
): Promise<GeneratedSocialPosts> {
  const startedAt = Date.now()
  const targetProviders = normalizeTargetProviders(modelConfig?.targetProviders)
  const provider = resolveGenerationBackend(modelConfig)
  logInfo('ai.generate.start', {
    provider,
    canonicalUrl: input.source.canonicalUrl,
    hasIntentPrompt: Boolean(input.intentPrompt?.trim()),
    targetProviders: targetProviders.join(','),
  })

  if (modelConfig?.aiProvider === 'codexCli') {
    try {
      const variants = await generateWithCodexCli(input, {
        model: modelConfig.codexCliModel ?? 'gpt-5.2',
        targetProviders,
      })
      logInfo('ai.generate.success', { provider, variantCount: variants.length })
      return {
        masterPost: buildFallbackMasterPost(input.source, input.intentPrompt),
        variants,
        metadata: {
          mode: 'ai',
          backend: 'codexCli',
          model: modelConfig.codexCliModel ?? 'gpt-5.2',
          durationMs: Date.now() - startedAt,
        },
      }
    } catch (error) {
      logError('ai.generate.failure', error, { provider })
      throw error
    }
  }

  if (modelConfig?.aiProvider === 'ollama') {
    const model = modelConfig.ollamaModel
    if (!model) throw new Error('Choose an Ollama model before generating drafts.')
    const tracker = createUsageTracker()
    try {
      const result = await generateWithOllama(input, {
        host: modelConfig.ollamaHost ?? DEFAULT_OLLAMA_HOST,
        model,
        targetProviders,
        middleware: [tracker.middleware],
      })
      logInfo('ai.generate.success', { provider, variantCount: result.variants.length })
      return {
        ...result,
        metadata: {
          mode: 'ai',
          backend: 'ollama',
          providerName: 'Ollama',
          model,
          durationMs: Date.now() - startedAt,
          usage: tracker.usage,
        },
      }
    } catch (error) {
      logError('ai.generate.failure', error, { provider })
      throw error
    }
  }

  if (modelConfig?.aiProvider === 'openaiCompatible') {
    const model = modelConfig.openaiCompatibleModel
    const baseUrl = modelConfig.openaiCompatibleBaseUrl
    if (!model || !baseUrl) {
      throw new Error('Configure an OpenAI-compatible base URL and model before generating drafts.')
    }
    const tracker = createUsageTracker()
    try {
      const result = await generateWithOpenAiCompatible(input, {
        baseUrl,
        apiKey: modelConfig.openaiCompatibleApiKey ?? DEFAULT_OPENAI_COMPATIBLE_API_KEY,
        model,
        providerName: modelConfig.openaiCompatibleProviderName ?? 'OpenAI-compatible',
        targetProviders,
        middleware: [tracker.middleware],
      })
      logInfo('ai.generate.success', { provider, variantCount: result.variants.length })
      return {
        ...result,
        metadata: {
          mode: 'ai',
          backend: 'openaiCompatible',
          providerName: modelConfig.openaiCompatibleProviderName ?? 'OpenAI-compatible',
          model,
          durationMs: Date.now() - startedAt,
          usage: tracker.usage,
        },
      }
    } catch (error) {
      logError('ai.generate.failure', error, { provider })
      throw error
    }
  }

  const apiKey = modelConfig?.openaiApiKey ?? process.env.OPENAI_API_KEY
  if (provider === 'openaiApiKey' && apiKey) {
    const model = modelConfig?.openaiModel ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_SOCIAL_MODEL
    const tracker = createUsageTracker()
    try {
      const result = await generateWithOpenAI(input, {
        apiKey,
        model,
        targetProviders,
        middleware: [tracker.middleware],
      })
      logInfo('ai.generate.success', { provider, variantCount: result.variants.length })
      return {
        ...result,
        metadata: {
          mode: 'ai',
          backend: 'openaiApiKey',
          providerName: 'OpenAI',
          model,
          durationMs: Date.now() - startedAt,
          usage: tracker.usage,
        },
      }
    } catch (error) {
      logError('ai.generate.failure', error, { provider })
      throw error
    }
  }

  const result = generateFallbackSocialPosts(input.source, input.intentPrompt, targetProviders)
  logInfo('ai.generate.success', { provider, variantCount: result.variants.length })
  return {
    ...result,
    metadata: {
      mode: 'template',
      backend: 'template',
      providerName: 'Template mode',
      durationMs: Date.now() - startedAt,
    },
  }
}

function generateFallbackSocialPosts(
  source: ImportedContentSource,
  intentPrompt?: string,
  targetProviders: Provider[] = [...providers],
): GeneratedSocialPostsPayload {
  const hook = intentPrompt?.trim() || source.description || source.excerpt || source.title
  const shortHook = trimToLength(hook, 180)
  const longHook = trimToLength(hook, 900)
  const urlLine = source.canonicalUrl ? `\n\n${source.canonicalUrl}` : ''
  const readMoreLine = source.canonicalUrl ? `\n\nRead more: ${source.canonicalUrl}` : ''
  const variants = [
    {
      provider: 'x',
      text: trimToLength(`${shortHook}${urlLine}`, 280),
      linkUrl: source.canonicalUrl,
      imageUrl: source.imageUrl,
    },
    {
      provider: 'linkedin',
      text: trimToLength(
        `${source.title}\n\n${longHook}${readMoreLine}`,
        3000,
      ),
      linkUrl: source.canonicalUrl,
      imageUrl: source.imageUrl,
    },
  ] satisfies ProviderVariant[]

  return {
    masterPost: buildFallbackMasterPost(source, intentPrompt),
    variants: variants.filter((variant) => targetProviders.includes(variant.provider)),
  }
}

async function generateWithOpenAI(
  input: MasterPostInput,
  config: {
    apiKey: string
    model: string
    targetProviders: Provider[]
    middleware?: ChatMiddleware[]
  },
): Promise<GeneratedSocialPosts> {
  const model = resolveOpenAIModel(config.model)
  logInfo('ai.openai.request.start', {
    model,
    targetProviders: config.targetProviders.join(','),
  })
  const result = await chat({
    adapter: createOpenaiChat(model, config.apiKey),
    middleware: config.middleware,
    messages: buildGenerationMessages(input, config.targetProviders),
    outputSchema: generatedSocialPostsSchema,
  })

  if (!result.variants.length) {
    throw new Error('AI response did not include provider variants.')
  }

  return {
    masterPost: result.masterPost,
    variants: normalizeGeneratedVariants(result.variants, input, config.targetProviders),
    metadata: {
      mode: 'ai',
      backend: 'openaiApiKey',
      model,
      durationMs: 0,
    },
  }
}

async function generateWithOllama(
  input: MasterPostInput,
  config: {
    host: string
    model: string
    targetProviders: Provider[]
    middleware?: ChatMiddleware[]
  },
): Promise<GeneratedSocialPosts> {
  const result = await chat({
    adapter: createOllamaChat(config.model, config.host),
    middleware: config.middleware,
    messages: buildGenerationMessages(input, config.targetProviders),
    outputSchema: generatedSocialPostsSchema,
  })

  return {
    masterPost: result.masterPost,
    variants: normalizeGeneratedVariants(result.variants, input, config.targetProviders),
    metadata: {
      mode: 'ai',
      backend: 'ollama',
      model: config.model,
      durationMs: 0,
    },
  }
}

async function generateWithOpenAiCompatible(
  input: MasterPostInput,
  config: {
    baseUrl: string
    apiKey: string
    model: string
    providerName: string
    targetProviders: Provider[]
    middleware?: ChatMiddleware[]
  },
): Promise<GeneratedSocialPosts> {
  const result = await chat({
    adapter: openaiCompatibleText(config.model, {
      name: config.providerName,
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    }),
    middleware: config.middleware,
    messages: buildGenerationMessages(input, config.targetProviders),
    outputSchema: generatedSocialPostsSchema,
  })

  return {
    masterPost: result.masterPost,
    variants: normalizeGeneratedVariants(result.variants, input, config.targetProviders),
    metadata: {
      mode: 'ai',
      backend: 'openaiCompatible',
      providerName: config.providerName,
      model: config.model,
      durationMs: 0,
    },
  }
}

async function generateWithCodexCli(
  input: MasterPostInput,
  config: { model: string; targetProviders: Provider[] },
): Promise<ProviderVariant[]> {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const workspace = await mkdtemp(join(tmpdir(), 'smd-codex-'))
  const outputFile = join(workspace, 'codex-output.txt')
  const startedAt = Date.now()
  const prompt = JSON.stringify({
    instructions: [
      'You are generating social media drafts for a non-interactive app.',
      'Return strict JSON only. Do not use markdown. Do not explain.',
      'The JSON must match this TypeScript shape: { "variants": Array<{ "provider": "x" | "linkedin", "text": string, "linkUrl": string, "imageUrl"?: string }> }.',
      `Create exactly one draft for each requested provider: ${config.targetProviders.join(', ')}.`,
      'Include the canonical URL in each draft.',
      'X must fit within 280 characters. LinkedIn must fit within 3000 characters.',
      'Take advantage of each platform: concise for X, fuller and more narrative for LinkedIn.',
    ],
    input,
  })

  try {
    logInfo('ai.codex.exec.start', { model: config.model })
    await runCodexExec({
      args: [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '--ignore-rules',
        '--sandbox',
        'read-only',
        '--ask-for-approval',
        'never',
        '--model',
        config.model,
        '--cd',
        workspace,
        '--output-last-message',
        outputFile,
        '-',
      ],
      input: prompt,
      timeoutMs: 120_000,
    })
    logInfo('ai.codex.exec.complete', { durationMs: Date.now() - startedAt })

    const raw = await readFile(outputFile, 'utf8')
    logInfo('ai.codex.output.read', { bytes: raw.length })
    const parsed = parseCodexJson(raw)

    if (!parsed.variants?.length) {
      throw new Error('Codex CLI response did not include provider variants.')
    }

    return normalizeGeneratedVariants(parsed.variants, input, config.targetProviders)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function runCodexExec({
  args,
  input,
  timeoutMs,
}: {
  args: string[]
  input: string
  timeoutMs: number
}) {
  const { spawn } = await import('node:child_process')

  return new Promise<void>((resolve, reject) => {
    const child = spawn('codex', args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      logError('ai.codex.exec.timeout', new Error('Codex CLI generation timed out.'), {
        timeoutMs,
      })
      reject(new Error('Codex CLI generation timed out.'))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      logError('ai.codex.exec.spawn_error', error)
      reject(
        new Error(
          error.message.includes('ENOENT')
            ? 'Codex CLI is not installed or not available on PATH.'
            : error.message,
        ),
      )
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      logInfo('ai.codex.exec.close', {
        code: code ?? -1,
        stdoutBytes: stdout.length,
        stderrBytes: stderr.length,
      })
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `Codex CLI exited with code ${code}.`))
    })
    child.stdin.end(input)
  })
}

function parseCodexJson(raw: string) {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Codex CLI did not return JSON.')
  }
  return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as { variants?: ProviderVariant[] }
}

function buildGenerationMessages(input: MasterPostInput, targetProviders: Provider[]) {
  return [
    {
      role: 'user' as const,
      content: JSON.stringify({
        instructions: [
          'You are generating reviewed social media drafts for a social media director app.',
          'Create a master post plus exactly one platform-specific post for each requested provider.',
          'The master post should be a strong reusable baseline, not a copy of the shortest platform variant.',
          'Each platform post must use that platform well rather than merely truncating the master post.',
          'X posts must be concise, punchy, scannable, and no more than 280 characters including the URL if used.',
          'LinkedIn posts should use the larger character budget with a clearer narrative, useful context, and a professional call to action.',
          'Always set linkUrl to the canonical URL string when one exists. Use null only when no canonical URL exists.',
          'Include the URL in text only when the platform post benefits from a visible URL.',
          'Use null for imageUrl when no image is available.',
          'Do not invent unsupported provider names.',
        ],
        requestedProviders: targetProviders,
        input,
      }),
    },
  ]
}

function createUsageTracker() {
  let usage: TokenUsage | undefined
  const middleware: ChatMiddleware = {
    name: 'social-media-director-usage',
    onUsage: (_context, nextUsage) => {
      usage = mergeUsage(usage, nextUsage)
    },
  }

  return {
    middleware,
    get usage() {
      return usage
    },
  }
}

function mergeUsage(current: TokenUsage | undefined, next: TokenUsage): TokenUsage {
  if (!current) return next
  return {
    ...next,
    promptTokens: (current.promptTokens ?? 0) + (next.promptTokens ?? 0),
    completionTokens: (current.completionTokens ?? 0) + (next.completionTokens ?? 0),
    totalTokens: (current.totalTokens ?? 0) + (next.totalTokens ?? 0),
  }
}

function resolveGenerationBackend(modelConfig?: GenerationConfig): GenerationMetadata['backend'] {
  if (modelConfig?.aiProvider) return modelConfig.aiProvider
  if (modelConfig?.openaiApiKey || process.env.OPENAI_API_KEY) return 'openaiApiKey'
  return 'template'
}

function trimToLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trim()}...`
}

function buildFallbackMasterPost(source: ImportedContentSource, intentPrompt?: string) {
  const hook = intentPrompt?.trim() || source.description || source.excerpt || source.title
  const readMoreLine = source.canonicalUrl ? `\n\nRead more: ${source.canonicalUrl}` : ''
  return trimToLength(`${source.title}\n\n${hook}${readMoreLine}`, 1200)
}

function normalizeTargetProviders(targetProviders?: Provider[]) {
  const requested = targetProviders?.length ? targetProviders : [...providers]
  return providers.filter((provider) => requested.includes(provider))
}

function normalizeGeneratedVariants(
  variants: Array<{
    provider: Provider
    text: string
    linkUrl?: string | null
    imageUrl?: string | null
  }>,
  input: MasterPostInput,
  targetProviders: Provider[],
): ProviderVariant[] {
  return targetProviders.flatMap((provider) => {
    const variant = variants.find((candidate) => candidate.provider === provider)
    if (!variant) return []

    return {
      provider,
      text: provider === 'x' ? trimToLength(variant.text, 280) : trimToLength(variant.text, 3000),
      linkUrl: variant.linkUrl || input.source.canonicalUrl || undefined,
      imageUrl: variant.imageUrl || input.source.imageUrl,
    }
  })
}

function resolveOpenAIModel(model: string): OpenAIChatModel {
  if (isOpenAIChatModel(model)) return model
  logInfo('ai.openai.model_fallback', {
    requestedModel: model,
    fallbackModel: DEFAULT_OPENAI_SOCIAL_MODEL,
  })
  return DEFAULT_OPENAI_SOCIAL_MODEL
}

function isOpenAIChatModel(model: string): model is OpenAIChatModel {
  return (OPENAI_CHAT_MODELS as readonly string[]).includes(model)
}
