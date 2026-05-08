import type { ImportedContentSource, ProviderVariant } from '../domain/providers'
import { getDb } from './client'

export async function saveImportedDraft(
  source: ImportedContentSource,
  variants: ProviderVariant[],
  intentPrompt?: string,
) {
  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('begin')
    const sourceResult = await client.query<{ id: string }>(
      `insert into content_sources
        (source_type, source_url, canonical_url, title, description, image_url, excerpt, body)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        'public_url',
        source.sourceUrl,
        source.canonicalUrl,
        source.title,
        source.description ?? null,
        source.imageUrl ?? null,
        source.excerpt ?? null,
        source.body ?? null,
      ],
    )

    const masterResult = await client.query<{ id: string }>(
      `insert into master_posts
        (content_source_id, intent_prompt, summary, default_link_url, default_image_url)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        sourceResult.rows[0]?.id,
        intentPrompt ?? null,
        source.excerpt ?? source.description ?? source.title,
        source.canonicalUrl,
        source.imageUrl ?? null,
      ],
    )

    const masterPostId = masterResult.rows[0]?.id
    for (const variant of variants) {
      await client.query(
        `insert into provider_variants
          (master_post_id, provider, text, link_url, image_url)
         values ($1, $2, $3, $4, $5)`,
        [
          masterPostId,
          variant.provider,
          variant.text,
          variant.linkUrl ?? null,
          variant.imageUrl ?? null,
        ],
      )
    }

    await client.query('commit')
    return masterPostId
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
