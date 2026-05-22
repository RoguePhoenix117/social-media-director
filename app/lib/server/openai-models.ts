import { sortOpenAiModelsForSocialPosts } from '../ai/recommended-models'
import { logInfo } from './logger'

export async function listOpenAiModels(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    logInfo('openai.models.non_ok', { status: response.status })
    const details = await response.text()
    throw new Error(details || 'OpenAI could not list models for this key.')
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> }
  const modelIds = (payload.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => Boolean(id))
    .filter(isUsefulTextModel)
    .sort((left, right) => left.localeCompare(right))

  if (!modelIds.length) {
    throw new Error('OpenAI returned no usable text models for this key.')
  }

  return sortOpenAiModelsForSocialPosts(modelIds)
}

function isUsefulTextModel(id: string) {
  if (
    id.includes('audio') ||
    id.includes('embedding') ||
    id.includes('image') ||
    id.includes('realtime') ||
    id.includes('sora') ||
    id.includes('tts') ||
    id.includes('transcribe') ||
    id.includes('whisper')
  ) {
    return false
  }

  return id.startsWith('gpt-') || id.startsWith('o')
}
