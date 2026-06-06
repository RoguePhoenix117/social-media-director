import type { Provider } from '../domain/providers'
import type { ImportedContentSource, ProviderVariant } from '../domain/providers'
import type { GenerationMetadata } from '../ai/generate-variants'
import { validateProviderPayload } from '../domain/validation'
import type {
  DraftCounts,
  DraftDetail,
  DraftListItem,
  DraftVariantRow,
  MasterPostStatus,
  ScheduledPostItem,
  ScheduledPostStatus,
} from './draft-types'
import { getDb } from './client'

export async function saveImportedDraft(
  source: ImportedContentSource,
  variants: ProviderVariant[],
  options?: {
    intentPrompt?: string
    projectId?: string | null
    generationMetadata?: GenerationMetadata | null
  },
) {
  const intentPrompt = options?.intentPrompt
  const projectId = options?.projectId ?? null
  const generationMetadata = options?.generationMetadata ?? null
  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('begin')
    const sourceResult = await client.query<{ id: string }>(
      `insert into content_sources
        (source_type, source_url, canonical_url, title, description, image_url, excerpt, body, project_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        projectId,
      ],
    )

    const masterResult = await client.query<{ id: string }>(
      `insert into master_posts
        (
          content_source_id,
          intent_prompt,
          summary,
          default_link_url,
          default_image_url,
          project_id,
          generation_mode,
          generation_backend,
          generation_provider_name,
          generation_model,
          generation_duration_ms,
          generation_usage
        )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
       returning id`,
      [
        sourceResult.rows[0]?.id,
        intentPrompt ?? null,
        source.excerpt ?? source.description ?? source.title,
        source.canonicalUrl,
        source.imageUrl ?? null,
        projectId,
        generationMetadata?.mode ?? null,
        generationMetadata?.backend ?? null,
        generationMetadata?.providerName ?? null,
        generationMetadata?.model ?? null,
        generationMetadata?.durationMs ?? null,
        generationMetadata?.usage ? JSON.stringify(generationMetadata.usage) : null,
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

export async function listDrafts(
  projectId: string,
  status?: MasterPostStatus,
): Promise<DraftListItem[]> {
  const params: unknown[] = [projectId]
  let statusFilter = ''
  if (status) {
    params.push(status)
    statusFilter = `and mp.status = $${params.length}`
  }

  const result = await getDb().query<{
    id: string
    status: MasterPostStatus
    summary: string
    source_title: string | null
    source_url: string | null
    created_at: string
    updated_at: string
  }>(
    `select mp.id, mp.status, mp.summary,
            cs.title as source_title, cs.canonical_url as source_url,
            mp.created_at, mp.updated_at
     from master_posts mp
     left join content_sources cs on cs.id = mp.content_source_id
     where mp.project_id = $1 ${statusFilter}
     order by mp.updated_at desc`,
    params,
  )

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    summary: row.summary,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function getDraft(masterPostId: string, projectId: string): Promise<DraftDetail | null> {
  const masterResult = await getDb().query<{
    id: string
    status: MasterPostStatus
    intent_prompt: string | null
    summary: string
    created_at: string
    updated_at: string
    source_title: string | null
    source_canonical_url: string | null
    source_excerpt: string | null
    source_image_url: string | null
    source_url: string | null
    generation_mode: GenerationMetadata['mode'] | null
    generation_backend: GenerationMetadata['backend'] | null
    generation_provider_name: string | null
    generation_model: string | null
    generation_duration_ms: number | null
    generation_usage: GenerationMetadata['usage'] | null
  }>(
    `select mp.id, mp.status, mp.intent_prompt, mp.summary, mp.created_at, mp.updated_at,
            mp.generation_mode, mp.generation_backend, mp.generation_provider_name,
            mp.generation_model, mp.generation_duration_ms, mp.generation_usage,
            cs.title as source_title, cs.canonical_url as source_canonical_url,
            cs.excerpt as source_excerpt, cs.image_url as source_image_url,
            cs.source_url
     from master_posts mp
     left join content_sources cs on cs.id = mp.content_source_id
     where mp.id = $1 and mp.project_id = $2`,
    [masterPostId, projectId],
  )

  const master = masterResult.rows[0]
  if (!master) return null

  const variantResult = await getDb().query<{
    id: string
    provider: Provider
    text: string
    link_url: string | null
    image_url: string | null
    validation_status: 'valid' | 'warning' | 'invalid'
    validation_messages: string[] | unknown
  }>(
    `select id, provider, text, link_url, image_url, validation_status, validation_messages
     from provider_variants
     where master_post_id = $1
     order by provider`,
    [masterPostId],
  )

  const variants: DraftVariantRow[] = variantResult.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    text: row.text,
    linkUrl: row.link_url,
    imageUrl: row.image_url,
    validationStatus: row.validation_status,
    validationMessages: normalizeValidationMessages(row.validation_messages),
  }))

  return {
    id: master.id,
    status: master.status,
    intentPrompt: master.intent_prompt,
    summary: master.summary,
    generationMetadata:
      master.generation_mode && master.generation_backend
        ? {
            mode: master.generation_mode,
            backend: master.generation_backend,
            providerName: master.generation_provider_name ?? undefined,
            model: master.generation_model ?? undefined,
            durationMs: master.generation_duration_ms ?? 0,
            usage: master.generation_usage ?? undefined,
          }
        : null,
    source: master.source_title
      ? {
          title: master.source_title,
          canonicalUrl: master.source_canonical_url ?? '',
          excerpt: master.source_excerpt,
          imageUrl: master.source_image_url,
          sourceUrl: master.source_url ?? '',
        }
      : null,
    variants,
    createdAt: master.created_at,
    updatedAt: master.updated_at,
  }
}

export async function updateVariantTexts(
  masterPostId: string,
  projectId: string,
  updates: Array<{ id: string; text: string }>,
  connectedProviders: Provider[],
): Promise<DraftDetail> {
  const draft = await getDraft(masterPostId, projectId)
  if (!draft) throw new Error('Draft not found.')

  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('begin')
    for (const update of updates) {
      const variant = draft.variants.find((row) => row.id === update.id)
      if (!variant) continue

      const validation = validateProviderPayload(variant.provider, {
        text: update.text,
        linkUrl: variant.linkUrl ?? undefined,
        imageUrl: variant.imageUrl ?? undefined,
      })

      await client.query(
        `update provider_variants
         set text = $1, validation_status = $2, validation_messages = $3::jsonb, updated_at = now()
         where id = $4 and master_post_id = $5`,
        [
          update.text,
          validation.status,
          JSON.stringify(validation.messages),
          update.id,
          masterPostId,
        ],
      )
    }

    if (draft.status !== 'published') {
      const nextStatus = canMarkReady(
        draft.variants.map((variant) => {
          const update = updates.find((row) => row.id === variant.id)
          return {
            provider: variant.provider,
            text: update?.text ?? variant.text,
            linkUrl: variant.linkUrl,
            imageUrl: variant.imageUrl,
          }
        }),
        connectedProviders,
      )
        ? draft.status === 'ready'
          ? 'ready'
          : 'draft'
        : 'draft'

      if (draft.status === 'ready' && nextStatus === 'draft') {
        await client.query(
          `update master_posts set status = 'draft', updated_at = now() where id = $1`,
          [masterPostId],
        )
      }
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }

  const refreshed = await getDraft(masterPostId, projectId)
  if (!refreshed) throw new Error('Draft not found after save.')
  return refreshed
}

export async function markDraftReady(
  masterPostId: string,
  projectId: string,
  connectedProviders: Provider[],
): Promise<DraftDetail> {
  const draft = await getDraft(masterPostId, projectId)
  if (!draft) throw new Error('Draft not found.')
  if (draft.status === 'published') {
    throw new Error('Published drafts cannot be marked ready.')
  }

  if (!canMarkReady(draft.variants, connectedProviders)) {
    throw new Error(
      'All connected platform variants must be valid before marking this draft ready.',
    )
  }

  await getDb().query(
    `update master_posts set status = 'ready', updated_at = now() where id = $1 and project_id = $2`,
    [masterPostId, projectId],
  )

  const refreshed = await getDraft(masterPostId, projectId)
  if (!refreshed) throw new Error('Draft not found after update.')
  return refreshed
}

function canMarkReady(
  variants: Array<{
    provider: Provider
    text: string
    linkUrl: string | null
    imageUrl: string | null
  }>,
  connectedProviders: Provider[],
): boolean {
  if (!connectedProviders.length) return false

  for (const provider of connectedProviders) {
    const variant = variants.find((row) => row.provider === provider)
    if (!variant) return false

    const validation = validateProviderPayload(provider, {
      text: variant.text,
      linkUrl: variant.linkUrl ?? undefined,
      imageUrl: variant.imageUrl ?? undefined,
    })
    if (validation.status !== 'valid') return false
  }

  return true
}

function normalizeValidationMessages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return []
}

export async function listReadyDrafts(projectId: string): Promise<DraftListItem[]> {
  return listDrafts(projectId, 'ready')
}

export async function listScheduledPosts(
  projectId: string,
  range?: { start: string; end: string },
): Promise<ScheduledPostItem[]> {
  const params: unknown[] = [projectId]
  let rangeFilter = ''
  if (range) {
    params.push(range.start, range.end)
    rangeFilter = `and sp.scheduled_at >= $2 and sp.scheduled_at <= $3`
  }

  const result = await getDb().query<{
    id: string
    master_post_id: string
    scheduled_at: string
    timezone: string
    status: ScheduledPostStatus
    summary: string
    error_message: string | null
  }>(
    `select sp.id, sp.master_post_id, sp.scheduled_at, sp.timezone, sp.status,
            mp.summary, sp.error_message
     from scheduled_posts sp
     join master_posts mp on mp.id = sp.master_post_id
     where sp.project_id = $1 ${rangeFilter}
     order by sp.scheduled_at asc`,
    params,
  )

  return result.rows.map((row) => ({
    id: row.id,
    masterPostId: row.master_post_id,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    status: row.status,
    summary: row.summary,
    errorMessage: row.error_message,
  }))
}

export async function createScheduledPost(input: {
  projectId: string
  masterPostId: string
  scheduledAt: string
  timezone: string
}): Promise<ScheduledPostItem> {
  const draft = await getDraft(input.masterPostId, input.projectId)
  if (!draft) throw new Error('Draft not found.')
  if (draft.status !== 'ready') {
    throw new Error('Only ready drafts can be scheduled.')
  }

  const result = await getDb().query<{
    id: string
    master_post_id: string
    scheduled_at: string
    timezone: string
    status: ScheduledPostStatus
    error_message: string | null
  }>(
    `insert into scheduled_posts (project_id, master_post_id, scheduled_at, timezone)
     values ($1, $2, $3, $4)
     returning id, master_post_id, scheduled_at, timezone, status, error_message`,
    [input.projectId, input.masterPostId, input.scheduledAt, input.timezone],
  )

  const row = result.rows[0]
  if (!row) throw new Error('Failed to schedule draft.')

  return {
    id: row.id,
    masterPostId: row.master_post_id,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    status: row.status,
    summary: draft.summary,
    errorMessage: row.error_message,
  }
}

export async function cancelScheduledPost(
  scheduledPostId: string,
  projectId: string,
): Promise<void> {
  const result = await getDb().query(
    `update scheduled_posts
     set status = 'cancelled', updated_at = now()
     where id = $1 and project_id = $2 and status = 'scheduled'`,
    [scheduledPostId, projectId],
  )
  if (result.rowCount === 0) {
    throw new Error('Scheduled post not found or cannot be cancelled.')
  }
}

export async function listDueScheduledPosts(limit = 20): Promise<
  Array<{
    id: string
    projectId: string
    masterPostId: string
  }>
> {
  const result = await getDb().query<{
    id: string
    project_id: string
    master_post_id: string
  }>(
    `select id, project_id, master_post_id
     from scheduled_posts
     where status = 'scheduled' and scheduled_at <= now()
     order by scheduled_at asc
     limit $1`,
    [limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    masterPostId: row.master_post_id,
  }))
}

export async function updateScheduledPostStatus(
  scheduledPostId: string,
  status: ScheduledPostStatus,
  errorMessage?: string,
): Promise<void> {
  await getDb().query(
    `update scheduled_posts
     set status = $2, error_message = $3, updated_at = now()
     where id = $1`,
    [scheduledPostId, status, errorMessage ?? null],
  )
}

export async function recordPublishAttempt(input: {
  providerVariantId: string
  providerAccountId: string
  status: 'pending' | 'published' | 'failed'
  providerPostId?: string
  providerPostUrl?: string
  providerResponse?: unknown
  errorCode?: string
  errorMessage?: string
}): Promise<void> {
  await getDb().query(
    `insert into publish_attempts
      (provider_variant_id, provider_account_id, status, provider_post_id,
       provider_post_url, provider_response, error_code, error_message)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      input.providerVariantId,
      input.providerAccountId,
      input.status,
      input.providerPostId ?? null,
      input.providerPostUrl ?? null,
      input.providerResponse ? JSON.stringify(input.providerResponse) : null,
      input.errorCode ?? null,
      input.errorMessage ?? null,
    ],
  )
}

export async function markMasterPostPublished(masterPostId: string, projectId: string): Promise<void> {
  await getDb().query(
    `update master_posts set status = 'published', updated_at = now()
     where id = $1 and project_id = $2`,
    [masterPostId, projectId],
  )
}

export async function getDraftCounts(projectId: string): Promise<DraftCounts> {
  const result = await getDb().query<{ status: MasterPostStatus; count: string }>(
    `select status, count(*)::text as count
     from master_posts
     where project_id = $1
     group by status`,
    [projectId],
  )

  const counts: DraftCounts = { draft: 0, ready: 0, published: 0, total: 0 }
  for (const row of result.rows) {
    const count = Number(row.count)
    counts[row.status] = count
    counts.total += count
  }
  return counts
}

export type RecentPublishItem = {
  id: string
  provider: Provider
  status: string
  providerPostUrl: string | null
  createdAt: string
  draftSummary: string
}

export async function listRecentPublishAttempts(
  projectId: string,
  limit = 5,
): Promise<RecentPublishItem[]> {
  const result = await getDb().query<{
    id: string
    provider: Provider
    status: string
    provider_post_url: string | null
    created_at: string
    summary: string
  }>(
    `select pa.id, pv.provider, pa.status, pa.provider_post_url, pa.created_at, mp.summary
     from publish_attempts pa
     join provider_variants pv on pv.id = pa.provider_variant_id
     join master_posts mp on mp.id = pv.master_post_id
     where mp.project_id = $1
     order by pa.created_at desc
     limit $2`,
    [projectId, limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    providerPostUrl: row.provider_post_url,
    createdAt: row.created_at,
    draftSummary: row.summary,
  }))
}

export type MonitorActivityItem = {
  id: string
  type: 'publish' | 'schedule'
  status: string
  title: string
  detail: string | null
  occurredAt: string
}

export async function listMonitorActivity(
  projectId: string,
  filter: 'all' | 'published' | 'failed' | 'upcoming' = 'all',
  limit = 50,
): Promise<MonitorActivityItem[]> {
  const publishRows = await getDb().query<{
    id: string
    status: string
    provider: Provider
    summary: string
    provider_post_url: string | null
    created_at: string
  }>(
    `select pa.id, pa.status, pv.provider, mp.summary, pa.provider_post_url, pa.created_at
     from publish_attempts pa
     join provider_variants pv on pv.id = pa.provider_variant_id
     join master_posts mp on mp.id = pv.master_post_id
     where mp.project_id = $1
     order by pa.created_at desc
     limit $2`,
    [projectId, limit],
  )

  const scheduleRows = await getDb().query<{
    id: string
    status: ScheduledPostStatus
    summary: string
    scheduled_at: string
    error_message: string | null
  }>(
    `select sp.id, sp.status, mp.summary, sp.scheduled_at, sp.error_message
     from scheduled_posts sp
     join master_posts mp on mp.id = sp.master_post_id
     where sp.project_id = $1
     order by sp.scheduled_at desc
     limit $2`,
    [projectId, limit],
  )

  const items: MonitorActivityItem[] = [
    ...publishRows.rows.map((row) => ({
      id: `publish-${row.id}`,
      type: 'publish' as const,
      status: row.status,
      title: row.summary,
      detail: row.provider_post_url,
      occurredAt: row.created_at,
    })),
    ...scheduleRows.rows.map((row) => ({
      id: `schedule-${row.id}`,
      type: 'schedule' as const,
      status: row.status,
      title: row.summary,
      detail: row.error_message,
      occurredAt: row.scheduled_at,
    })),
  ]

  const filtered = items.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'published') return item.status === 'published'
    if (filter === 'failed') return item.status === 'failed'
    if (filter === 'upcoming') {
      return item.type === 'schedule' && item.status === 'scheduled'
    }
    return true
  })

  return filtered
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, limit)
}

export type InternalStats = {
  draftsLast7Days: number
  draftsLast30Days: number
  publishedByProvider: Record<Provider, number>
  scheduledTotal: number
  scheduledFailed: number
}

export async function getInternalStats(projectId: string): Promise<InternalStats> {
  const draftCounts = await getDb().query<{ count: string }>(
    `select count(*)::text as count from master_posts
     where project_id = $1 and created_at >= now() - interval '7 days'`,
    [projectId],
  )
  const draftCounts30 = await getDb().query<{ count: string }>(
    `select count(*)::text as count from master_posts
     where project_id = $1 and created_at >= now() - interval '30 days'`,
    [projectId],
  )
  const publishedByProvider = await getDb().query<{ provider: Provider; count: string }>(
    `select pv.provider, count(*)::text as count
     from publish_attempts pa
     join provider_variants pv on pv.id = pa.provider_variant_id
     join master_posts mp on mp.id = pv.master_post_id
     where mp.project_id = $1 and pa.status = 'published'
     group by pv.provider`,
    [projectId],
  )
  const scheduledStats = await getDb().query<{ status: ScheduledPostStatus; count: string }>(
    `select status, count(*)::text as count from scheduled_posts
     where project_id = $1
     group by status`,
    [projectId],
  )

  const published: Record<Provider, number> = { x: 0, linkedin: 0 }
  for (const row of publishedByProvider.rows) {
    published[row.provider] = Number(row.count)
  }

  let scheduledTotal = 0
  let scheduledFailed = 0
  for (const row of scheduledStats.rows) {
    scheduledTotal += Number(row.count)
    if (row.status === 'failed') scheduledFailed += Number(row.count)
  }

  return {
    draftsLast7Days: Number(draftCounts.rows[0]?.count ?? 0),
    draftsLast30Days: Number(draftCounts30.rows[0]?.count ?? 0),
    publishedByProvider: published,
    scheduledTotal,
    scheduledFailed,
  }
}
