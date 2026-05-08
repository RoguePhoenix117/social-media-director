import { describe, expect, it } from 'vitest'
import { generateProviderVariants } from '../app/lib/ai/generate-variants'

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
})
