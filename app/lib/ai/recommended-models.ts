/**
 * Model picks for Social Media Director — short platform-specific post copy,
 * not long-form or deep reasoning. Prefer fast, cheap chat models.
 */

/** Canonical default when nothing else matches. */
export const DEFAULT_OPENAI_SOCIAL_MODEL = 'gpt-4.1-mini'

/** Exact model ids to prefer, most suitable first. */
export const OPENAI_SOCIAL_POST_MODEL_PREFERENCES = [
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'gpt-3.5-turbo',
] as const

export function pickRecommendedOpenAiModel(availableIds: readonly string[]): string {
  if (!availableIds.length) return DEFAULT_OPENAI_SOCIAL_MODEL

  const available = new Set(availableIds)
  for (const preferred of OPENAI_SOCIAL_POST_MODEL_PREFERENCES) {
    if (available.has(preferred)) return preferred
  }

  const miniLike = availableIds
    .filter((id) => isGptChatModel(id) && /mini|nano/i.test(id))
    .sort((left, right) => left.localeCompare(right))
  if (miniLike[0]) return miniLike[0]

  const gptChat = availableIds.filter(isGptChatModel).sort((left, right) => left.localeCompare(right))
  if (gptChat[0]) return gptChat[0]

  return availableIds[0] ?? DEFAULT_OPENAI_SOCIAL_MODEL
}

/** Puts the recommended model first; remaining ids stay alphabetical. */
export function sortOpenAiModelsForSocialPosts(availableIds: readonly string[]): string[] {
  const recommended = pickRecommendedOpenAiModel(availableIds)
  const rest = availableIds.filter((id) => id !== recommended).sort((left, right) => left.localeCompare(right))
  return [recommended, ...rest]
}

export function isRecommendedOpenAiSocialModel(
  modelId: string,
  availableIds: readonly string[],
): boolean {
  return modelId === pickRecommendedOpenAiModel(availableIds)
}

export function openAiModelOptionLabel(modelId: string, availableIds: readonly string[]): string {
  if (isRecommendedOpenAiSocialModel(modelId, availableIds)) {
    return `${modelId} — recommended for social posts`
  }
  return modelId
}

function isGptChatModel(id: string): boolean {
  return id.startsWith('gpt-') && !id.startsWith('o')
}
