import { describe, expect, it } from 'vitest'
import { parseBlogHtml } from '../app/lib/import/public-url'

describe('parseBlogHtml', () => {
  it('extracts canonical metadata and article text from a public blog page', () => {
    const source = parseBlogHtml(
      `
        <html>
          <head>
            <title>Fallback title</title>
            <link rel="canonical" href="/posts/launch" />
            <meta property="og:title" content="Launch notes" />
            <meta property="og:description" content="A short launch summary." />
            <meta property="og:image" content="/launch.png" />
          </head>
          <body>
            <nav>Navigation</nav>
            <article>
              <h1>Launch notes</h1>
              <p>We shipped a focused MVP for social media publishing.</p>
            </article>
          </body>
        </html>
      `,
      'https://example.com/blog/launch',
    )

    expect(source.title).toBe('Launch notes')
    expect(source.canonicalUrl).toBe('https://example.com/posts/launch')
    expect(source.imageUrl).toBe('https://example.com/launch.png')
    expect(source.excerpt).toBe('A short launch summary.')
    expect(source.body).toContain('focused MVP')
    expect(source.body).not.toContain('Navigation')
  })
})
