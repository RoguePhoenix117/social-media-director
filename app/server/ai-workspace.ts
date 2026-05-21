import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { aiBackendTypes } from '../lib/domain/ai-backends'
import { listCodexCliModels, getCodexCliStatus } from '../lib/server/codex-cli'
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

const saveOpenAiInputSchema = z.object({
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().min(1, 'Choose a model.'),
})

const saveCodexInputSchema = z.object({
  codexCliModel: z.string().min(1, 'Choose a Codex CLI model.'),
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
