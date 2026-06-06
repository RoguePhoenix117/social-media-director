import * as cheerio from 'cheerio'
import type { ImportedContentSource } from '../domain/providers'
import { sanitizePreviewImageUrl } from './preview-image'

export async function importPublicBlogUrl(url: string): Promise<ImportedContentSource> {
  const parsedUrl = parseHttpUrl(url)
  const response = await fetch(parsedUrl.toString(), {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'SocialMediaDirector/0.1 (+https://github.com/soft-cypher-ventures/social-media-director)',
    },
  })

  if (!response.ok) {
    throw new Error(`Could not fetch URL: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('URL did not return an HTML page.')
  }

  return parseBlogHtml(await response.text(), parsedUrl.toString())
}

export function parseBlogHtml(html: string, sourceUrl: string): ImportedContentSource {
  const $ = cheerio.load(html)
  $('script, style, noscript, svg, nav, header, footer, aside').remove()

  const canonicalUrl =
    absolutize($('link[rel="canonical"]').attr('href'), sourceUrl) ?? sourceUrl
  const title =
    cleanText(meta($, 'og:title') ?? $('title').first().text() ?? $('h1').first().text()) ||
    canonicalUrl
  const description = cleanText(
    meta($, 'og:description') ?? $('meta[name="description"]').attr('content') ?? '',
  )
  const imageUrl = sanitizePreviewImageUrl(
    absolutize(meta($, 'og:image') ?? '', canonicalUrl),
  )
  const article = $('article').first()
  const bodyContainer = article.length ? article : $('main').first()
  const bodyText = cleanText((bodyContainer.length ? bodyContainer : $('body')).text())
  const excerpt = description || truncateAtWord(bodyText, 240)

  return {
    sourceType: 'public_url',
    sourceUrl,
    canonicalUrl,
    title,
    description: description || undefined,
    imageUrl,
    excerpt: excerpt || undefined,
    body: bodyText || undefined,
  }
}

function meta($: cheerio.CheerioAPI, property: string) {
  return (
    $(`meta[property="${property}"]`).attr('content') ??
    $(`meta[name="${property}"]`).attr('content')
  )
}

function parseHttpUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid absolute URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs can be imported.')
  }

  return url
}

function absolutize(value: string | undefined, base: string) {
  if (!value) return undefined
  try {
    return new URL(value, base).toString()
  } catch {
    return undefined
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  const truncated = value.slice(0, maxLength)
  return `${truncated.slice(0, truncated.lastIndexOf(' ')).trim()}...`
}
