import { describe, expect, it } from 'vitest'
import {
  generateProviderVariants,
  generateSocialPosts,
} from '../app/lib/ai/generate-variants'

describe('generateProviderVariants', () => {
  it('generates reviewable X and LinkedIn fallback variants', async () => {
    const variants = await generateProviderVariants({
      source: {
        sourceType: 'public_url',
        sourceUrl: 'https://example.com/blog/launch',
        canonicalUrl: 'https://example.com/blog/launch',
        title: 'Launch notes',
        description: 'A focused MVP for social media publishing.',
      },
      intentPrompt: 'Announce the launch.',
    })

    expect(variants.map((variant) => variant.provider)).toEqual(['x', 'linkedin'])
    expect(variants[0]?.text).toContain('https://example.com/blog/launch')
    expect(variants[0]?.text.length).toBeLessThanOrEqual(280)
    expect(variants[1]?.text).toContain('Read more:')
  })

  it('generates only connected target providers when scoped', async () => {
    const variants = await generateProviderVariants(
      {
        source: {
          sourceType: 'public_url',
          sourceUrl: 'https://example.com/blog/launch',
          canonicalUrl: 'https://example.com/blog/launch',
          title: 'Launch notes',
          description: 'A focused MVP for social media publishing.',
        },
        intentPrompt: 'Announce the launch.',
      },
      { targetProviders: ['x'] },
    )

    expect(variants.map((variant) => variant.provider)).toEqual(['x'])
  })

  it('returns a master post and only requested platform variants', async () => {
    const result = await generateSocialPosts(
      {
        source: {
          sourceType: 'public_url',
          sourceUrl: 'https://example.com/blog/launch',
          canonicalUrl: 'https://example.com/blog/launch',
          title: 'Launch notes',
          description: 'A focused MVP for social media publishing.',
        },
        intentPrompt: 'Announce the launch.',
      },
      {
        targetProviders: ['linkedin'],
      },
    )

    expect(result.masterPost).toContain('Launch notes')
    expect(result.metadata).toMatchObject({
      backend: 'template',
      mode: 'template',
    })
    expect(result.variants).toHaveLength(1)
    expect(result.variants[0]?.provider).toBe('linkedin')
    expect(result.variants[0]?.text).toContain('Read more:')
  })

  it('requires an Ollama model when the Ollama backend is active', async () => {
    await expect(
      generateSocialPosts(
        {
          source: {
            sourceType: 'public_url',
            sourceUrl: 'https://example.com/blog/launch',
            canonicalUrl: 'https://example.com/blog/launch',
            title: 'Launch notes',
            description: 'A focused MVP for social media publishing.',
          },
        },
        { aiProvider: 'ollama', targetProviders: ['x'] },
      ),
    ).rejects.toThrow('Choose an Ollama model')
  })
})
