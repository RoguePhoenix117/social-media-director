import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  listOllamaModels,
  listOpenAiCompatibleModels,
  normalizeBaseUrl,
} from '../app/lib/server/local-ai-models'

describe('local AI model discovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes base URLs and removes trailing slashes', () => {
    expect(normalizeBaseUrl('http://localhost:11434///')).toBe('http://localhost:11434')
  })

  it('lists Ollama model names from /api/tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }, { model: 'qwen3:4b' }],
        }),
      })),
    )

    await expect(listOllamaModels('http://localhost:11434')).resolves.toEqual([
      'llama3.2:3b',
      'qwen3:4b',
    ])
  })

  it('lists OpenAI-compatible models from /models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ id: 'local-model' }],
        }),
      })),
    )

    await expect(
      listOpenAiCompatibleModels({
        baseUrl: 'http://localhost:1234/v1',
        apiKey: 'local',
      }),
    ).resolves.toEqual(['local-model'])
  })
})
