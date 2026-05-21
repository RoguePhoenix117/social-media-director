import pg from 'pg'

const { Pool } = pg

const dbStatementTimeoutMs = 5_000
const dbConnectTimeoutMs = 5_000

let pool: pg.Pool | undefined

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: withStatementTimeout(process.env.DATABASE_URL),
      connectionTimeoutMillis: dbConnectTimeoutMs,
    })
  }

  return pool
}

function withStatementTimeout(connectionString: string) {
  if (/statement_timeout/i.test(connectionString)) return connectionString
  const separator = connectionString.includes('?') ? '&' : '?'
  return `${connectionString}${separator}options=-c%20statement_timeout%3D${dbStatementTimeoutMs}`
}

export async function queryWithTimeout<T extends pg.QueryResultRow>(
  queryText: string,
  values?: unknown[],
  timeoutMs = dbStatementTimeoutMs + 1_000,
) {
  const db = getDb()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      db.query<T>(queryText, values),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('Database query timed out.'), { code: 'ETIMEDOUT' }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
