import crypto from 'node:crypto'
import { getDb } from '../../db/client'

/**
 * Short-lived (10 minute) OAuth handoff records. Each row binds a
 * `state_token` (CSRF defense) and PKCE `code_verifier` to the operator +
 * project that started the flow. Rows are single-use: {@link consumeOAuthState}
 * deletes after read.
 *
 * Encrypting the `code_verifier` is deliberately skipped — the row only
 * survives 10 minutes, only the operator who started the flow can consume it,
 * and the token never leaves the server. PKCE is already CSRF defense; we
 * only need integrity here.
 */

export type OAuthProvider = 'x' | 'linkedin'

const STATE_TTL_SECONDS = 60 * 10

export type CreateOAuthStateInput = {
  operatorId: string
  projectId: string
  provider: OAuthProvider
  redirectAfter?: string | null
}

export type CreatedOAuthState = {
  stateToken: string
  codeVerifier: string
  codeChallenge: string
}

export type ConsumedOAuthState = {
  id: string
  operatorId: string
  projectId: string
  provider: OAuthProvider
  codeVerifier: string
  redirectAfter: string | null
}

type OAuthStateRow = {
  id: string
  operator_id: string
  project_id: string
  provider: OAuthProvider
  code_verifier: string
  redirect_after: string | null
  expires_at: string
}

export async function createOAuthState(
  input: CreateOAuthStateInput,
): Promise<CreatedOAuthState> {
  const stateToken = base64url(crypto.randomBytes(32))
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())

  await getDb().query(
    `insert into oauth_states (
       operator_id, project_id, provider, state_token, code_verifier, redirect_after, expires_at
     )
     values ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval)`,
    [
      input.operatorId,
      input.projectId,
      input.provider,
      stateToken,
      codeVerifier,
      input.redirectAfter ?? null,
      STATE_TTL_SECONDS,
    ],
  )

  return { stateToken, codeVerifier, codeChallenge }
}

/**
 * Atomic "validate + delete" so a state token can never be replayed even if
 * two callbacks race. Returns null if the token is unknown, expired, or for a
 * different operator/project than the caller expects.
 */
export async function consumeOAuthState(input: {
  stateToken: string
  expectedOperatorId: string
  expectedProvider: OAuthProvider
}): Promise<ConsumedOAuthState | null> {
  if (!input.stateToken) return null

  const result = await getDb().query<OAuthStateRow>(
    `delete from oauth_states
     where state_token = $1
     returning id, operator_id, project_id, provider, code_verifier, redirect_after, expires_at`,
    [input.stateToken],
  )

  const row = result.rows[0]
  if (!row) return null
  if (row.operator_id !== input.expectedOperatorId) return null
  if (row.provider !== input.expectedProvider) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) return null

  return {
    id: row.id,
    operatorId: row.operator_id,
    projectId: row.project_id,
    provider: row.provider,
    codeVerifier: row.code_verifier,
    redirectAfter: row.redirect_after,
  }
}

/**
 * Best-effort cleanup of expired rows. Called opportunistically from the
 * start route so we don't need a cron job — the table only ever holds tens
 * of rows in practice.
 */
export async function purgeExpiredOAuthStates(): Promise<void> {
  await getDb().query('delete from oauth_states where expires_at <= now()')
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
