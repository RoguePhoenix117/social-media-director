import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | undefined

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  return pool
}
