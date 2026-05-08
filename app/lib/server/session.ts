import crypto from 'node:crypto'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { getDb } from '../db/client'
import { hashToken } from './crypto'

const SESSION_COOKIE = 'smd_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

export type OperatorSession = {
  sessionId: string
  operatorId: string
  email: string
  firstName: string | null
  onboardingStepCompleted: number
}

export async function createOperatorSession(operatorId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const db = getDb()
  await db.query(
    `insert into operator_sessions (operator_id, token_hash, expires_at)
     values ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [operatorId, tokenHash, SESSION_MAX_AGE_SECONDS],
  )
  setSessionCookie(token)
}

export async function readOperatorSession(): Promise<OperatorSession | null> {
  const token = readSessionToken()
  if (!token) return null

  const result = await getDb().query<OperatorSession>(
    `select
       operator_sessions.id as "sessionId",
       operators.id as "operatorId",
       operators.email,
       operators.first_name as "firstName",
       operators.onboarding_step_completed as "onboardingStepCompleted"
     from operator_sessions
     join operators on operators.id = operator_sessions.operator_id
     where operator_sessions.token_hash = $1
       and operator_sessions.expires_at > now()
     limit 1`,
    [hashToken(token)],
  )

  return result.rows[0] ?? null
}

export async function requireOperatorSession() {
  const session = await readOperatorSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function destroyCurrentSession() {
  const token = readSessionToken()
  if (token) {
    await getDb().query('delete from operator_sessions where token_hash = $1', [
      hashToken(token),
    ])
  }
  clearSessionCookie()
}

function setSessionCookie(token: string) {
  const secure = process.env.APP_ORIGIN?.startsWith('https://') ? '; Secure' : ''
  setResponseHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`,
  )
}

function clearSessionCookie() {
  const secure = process.env.APP_ORIGIN?.startsWith('https://') ? '; Secure' : ''
  setResponseHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
  )
}

function readSessionToken() {
  const header = getRequestHeader('cookie')
  if (!header) return null

  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq) === SESSION_COOKIE) return part.slice(eq + 1)
  }

  return null
}
