import { getDb } from '../db/client'

export type ProviderName = 'x' | 'linkedin'

export type ProjectChannel = {
  id: string
  projectId: string
  provider: ProviderName
  externalAccountId: string
  displayName: string
  username: string | null
  profileImageUrl: string | null
  authorUrn: string | null
  accessTokenCiphertext: string
  refreshTokenCiphertext: string | null
  tokenExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type PublicProjectChannel = Pick<
  ProjectChannel,
  'id' | 'provider' | 'displayName' | 'username' | 'profileImageUrl' | 'createdAt'
>

type ProviderAccountRow = {
  id: string
  project_id: string
  provider: ProviderName
  external_account_id: string
  display_name: string
  username: string | null
  profile_image_url: string | null
  author_urn: string | null
  access_token_ciphertext: string
  refresh_token_ciphertext: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export async function listProjectChannels(projectId: string): Promise<ProjectChannel[]> {
  const result = await getDb().query<ProviderAccountRow>(
    `select
       id,
       project_id,
       provider,
       external_account_id,
       display_name,
       username,
       profile_image_url,
       author_urn,
       access_token_ciphertext,
       refresh_token_ciphertext,
       token_expires_at,
       created_at,
       updated_at
     from provider_accounts
     where project_id = $1
     order by created_at asc`,
    [projectId],
  )
  return result.rows.map(mapRow)
}

export async function listPublicProjectChannels(
  projectId: string,
): Promise<PublicProjectChannel[]> {
  const channels = await listProjectChannels(projectId)
  return channels.map(toPublicChannel)
}

export async function getProjectChannel(
  projectId: string,
  provider: ProviderName,
): Promise<ProjectChannel | null> {
  const result = await getDb().query<ProviderAccountRow>(
    `select
       id,
       project_id,
       provider,
       external_account_id,
       display_name,
       username,
       profile_image_url,
       author_urn,
       access_token_ciphertext,
       refresh_token_ciphertext,
       token_expires_at,
       created_at,
       updated_at
     from provider_accounts
     where project_id = $1 and provider = $2
     limit 1`,
    [projectId, provider],
  )
  const row = result.rows[0]
  return row ? mapRow(row) : null
}

export type UpsertProviderAccountInput = {
  projectId: string
  provider: ProviderName
  externalAccountId: string
  displayName: string
  username?: string | null
  profileImageUrl?: string | null
  authorUrn?: string | null
  accessTokenCiphertext: string
  refreshTokenCiphertext?: string | null
  tokenExpiresAt?: string | Date | null
}

export async function upsertProviderAccount(
  input: UpsertProviderAccountInput,
): Promise<ProjectChannel> {
  const expiresAt =
    input.tokenExpiresAt instanceof Date ? input.tokenExpiresAt.toISOString() : input.tokenExpiresAt
  const result = await getDb().query<ProviderAccountRow>(
    `insert into provider_accounts (
       project_id, provider, external_account_id, display_name,
       username, profile_image_url, author_urn,
       access_token_ciphertext, refresh_token_ciphertext, token_expires_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (project_id, provider)
     where project_id is not null
     do update set
       external_account_id = excluded.external_account_id,
       display_name = excluded.display_name,
       username = excluded.username,
       profile_image_url = excluded.profile_image_url,
       author_urn = excluded.author_urn,
       access_token_ciphertext = excluded.access_token_ciphertext,
       refresh_token_ciphertext = coalesce(excluded.refresh_token_ciphertext, provider_accounts.refresh_token_ciphertext),
       token_expires_at = excluded.token_expires_at,
       updated_at = now()
     returning
       id,
       project_id,
       provider,
       external_account_id,
       display_name,
       username,
       profile_image_url,
       author_urn,
       access_token_ciphertext,
       refresh_token_ciphertext,
       token_expires_at,
       created_at,
       updated_at`,
    [
      input.projectId,
      input.provider,
      input.externalAccountId,
      input.displayName,
      input.username ?? null,
      input.profileImageUrl ?? null,
      input.authorUrn ?? null,
      input.accessTokenCiphertext,
      input.refreshTokenCiphertext ?? null,
      expiresAt ?? null,
    ],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Failed to upsert provider account.')
  return mapRow(row)
}

export async function disconnectChannel(input: {
  projectId: string
  provider: ProviderName
}): Promise<void> {
  await getDb().query(
    `delete from provider_accounts
     where project_id = $1 and provider = $2`,
    [input.projectId, input.provider],
  )
}

function mapRow(row: ProviderAccountRow): ProjectChannel {
  return {
    id: row.id,
    projectId: row.project_id,
    provider: row.provider,
    externalAccountId: row.external_account_id,
    displayName: row.display_name,
    username: row.username,
    profileImageUrl: row.profile_image_url,
    authorUrn: row.author_urn,
    accessTokenCiphertext: row.access_token_ciphertext,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toPublicChannel(channel: ProjectChannel): PublicProjectChannel {
  return {
    id: channel.id,
    provider: channel.provider,
    displayName: channel.displayName,
    username: channel.username,
    profileImageUrl: channel.profileImageUrl,
    createdAt: channel.createdAt,
  }
}
