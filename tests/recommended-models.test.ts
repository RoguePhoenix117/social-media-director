import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPENAI_SOCIAL_MODEL,
  pickRecommendedOpenAiModel,
  sortOpenAiModelsForSocialPosts,
} from '../app/lib/ai/recommended-models'

describe('recommended OpenAI models for social posts', () => {
  it('prefers nano/mini models in order', () => {
    const available = [
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o3-mini',
      'gpt-4o',
    ]
    expect(pickRecommendedOpenAiModel(available)).toBe('gpt-4.1-nano')
  })

  it('falls back to mini-like gpt models when exact preferences are unavailable', () => {
    expect(pickRecommendedOpenAiModel(['gpt-4o', 'gpt-4o-mini', 'o3-mini'])).toBe('gpt-4o-mini')
  })

  it('returns the default when no models are listed', () => {
    expect(pickRecommendedOpenAiModel([])).toBe(DEFAULT_OPENAI_SOCIAL_MODEL)
  })

  it('sorts the recommended model to the top of the list', () => {
    expect(
      sortOpenAiModelsForSocialPosts(['z-model', 'gpt-4.1-mini', 'gpt-4.1-nano']),
    ).toEqual(['gpt-4.1-nano', 'gpt-4.1-mini', 'z-model'])
  })
})
