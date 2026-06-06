import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { aiBackendTypes } from '../lib/domain/ai-backends'
import { listCodexCliModels, getCodexCliStatus } from '../lib/server/codex-cli'
import {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OPENAI_COMPATIBLE_API_KEY,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listOllamaModels,
  listOpenAiCompatibleModels,
  normalizeBaseUrl,
} from '../lib/server/local-ai-models'
import { listOpenAiModels } from '../lib/server/openai-models'
import {
  getOperatorAiSettings,
  getPublicSettingsStatus,
  saveOperatorAiConnection,
  setActiveAiBackend,
} from '../lib/server/settings'
import { requireOperatorSession } from '../lib/server/session'

const openAiTestInputSchema = z.object({
  openaiApiKey: z.string().optional(),
})

const codexTestInputSchema = z.object({})

const ollamaTestInputSchema = z.object({
  ollamaHost: z.string().optional(),
})

const openAiCompatibleTestInputSchema = z.object({
  providerName: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
})

const saveTemplateInputSchema = z.object({})

const saveOpenAiInputSchema = z.object({
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().min(1, 'Choose a model.'),
})

const saveCodexInputSchema = z.object({
  codexCliModel: z.string().min(1, 'Choose a Codex CLI model.'),
})

const saveOllamaInputSchema = z.object({
  ollamaHost: z.string().min(1, 'Enter an Ollama host.'),
  ollamaModel: z.string().min(1, 'Choose an Ollama model.'),
})

const saveOpenAiCompatibleInputSchema = z.object({
  providerName: z.string().optional(),
  baseUrl: z.string().min(1, 'Enter a base URL.'),
  apiKey: z.string().optional(),
  model: z.string().min(1, 'Choose a model.'),
})

const setActiveAiBackendInputSchema = z.object({
  backendType: z.enum(aiBackendTypes).nullable(),
})

export const testOpenAiConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => openAiTestInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const stored = await getOperatorAiSettings(session.operatorId)
    const apiKey = data.openaiApiKey?.trim() || stored.openaiApiKey
    if (!apiKey) {
      throw new Error('Enter an OpenAI API key.')
    }
    const models = await listOpenAiModels(apiKey)
    return { models }
  })

export const testCodexConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => codexTestInputSchema.parse(input))
  .handler(async () => {
    await requireOperatorSession()
    const status = await getCodexCliStatus()
    if (!status.authenticated) {
      throw new Error(status.message)
    }
    const models = await listCodexCliModels()
    return { models, status }
  })

export const testOllamaConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => ollamaTestInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    const host = normalizeBaseUrl(data.ollamaHost?.trim() || DEFAULT_OLLAMA_HOST)
    const models = await listOllamaModels(host)
    return { host, models }
  })

export const testOpenAiCompatibleConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => openAiCompatibleTestInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const stored = await getOperatorAiSettings(session.operatorId)
    const baseUrl = normalizeBaseUrl(
      data.baseUrl?.trim() ||
        stored.openaiCompatibleBaseUrl ||
        DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    )
    const apiKey =
      data.apiKey?.trim() ||
      stored.openaiCompatibleApiKey ||
      DEFAULT_OPENAI_COMPATIBLE_API_KEY
    const models = await listOpenAiCompatibleModels({ baseUrl, apiKey })
    return {
      providerName: data.providerName?.trim() || stored.openaiCompatibleProviderName || 'Local',
      baseUrl,
      models,
    }
  })

export const saveTemplateConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveTemplateInputSchema.parse(input))
  .handler(async () => {
    const session = await requireOperatorSession()
    await saveOperatorAiConnection(session.operatorId, 'template', {
      markVerified: true,
      setActiveIfUnset: true,
    })
    return getPublicSettingsStatus()
  })

export const saveOpenAiConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveOpenAiInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const stored = await getOperatorAiSettings(session.operatorId)
    const apiKey = data.openaiApiKey?.trim() || stored.openaiApiKey
    if (!apiKey) {
      throw new Error('Enter an OpenAI API key.')
    }
    await saveOperatorAiConnection(session.operatorId, 'openaiApiKey', {
      openaiApiKey: apiKey,
      openaiModel: data.openaiModel,
      markVerified: true,
      setActiveIfUnset: true,
    })
    return getPublicSettingsStatus()
  })

export const saveCodexConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveCodexInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    await saveOperatorAiConnection(session.operatorId, 'codexCli', {
      codexCliModel: data.codexCliModel,
      markVerified: true,
      setActiveIfUnset: true,
    })
    return getPublicSettingsStatus()
  })

export const saveOllamaConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveOllamaInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const host = normalizeBaseUrl(data.ollamaHost)
    await saveOperatorAiConnection(session.operatorId, 'ollama', {
      ollamaHost: host,
      ollamaModel: data.ollamaModel,
      markVerified: true,
      setActiveIfUnset: true,
    })
    return getPublicSettingsStatus()
  })

export const saveOpenAiCompatibleConnection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveOpenAiCompatibleInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const stored = await getOperatorAiSettings(session.operatorId)
    const baseUrl = normalizeBaseUrl(data.baseUrl)
    await saveOperatorAiConnection(session.operatorId, 'openaiCompatible', {
      openaiCompatibleProviderName: data.providerName?.trim() || 'Local',
      openaiCompatibleBaseUrl: baseUrl,
      openaiCompatibleApiKey:
        data.apiKey?.trim() || stored.openaiCompatibleApiKey || DEFAULT_OPENAI_COMPATIBLE_API_KEY,
      openaiCompatibleModel: data.model,
      markVerified: true,
      setActiveIfUnset: true,
    })
    return getPublicSettingsStatus()
  })

export const setActiveAiBackendSelection = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => setActiveAiBackendInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    if (data.backendType) {
      const status = await getPublicSettingsStatus()
      if (!status.configuredAiBackendTypes.includes(data.backendType)) {
        throw new Error('That AI backend is not configured yet.')
      }
    }
    await setActiveAiBackend(session.operatorId, data.backendType)
    return getPublicSettingsStatus()
  })
