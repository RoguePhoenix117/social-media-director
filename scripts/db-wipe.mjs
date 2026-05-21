import pg from 'pg'

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required. Copy .env.example to .env or set DATABASE_URL.')
  process.exit(1)
}

const client = new Client({ connectionString: databaseUrl })

try {
  await client.connect()
  const { rows } = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `)

  if (!rows.length) {
    console.log('No public tables found. Run pnpm db:up (or pnpm db:reset) first.')
    process.exit(0)
  }

  const tableList = rows.map((row) => `"${row.tablename}"`).join(', ')
  await client.query(`truncate table ${tableList} restart identity cascade`)

  console.log('Database wiped: schema kept, all rows removed.')
  console.log(`Truncated ${rows.length} tables: ${rows.map((row) => row.tablename).join(', ')}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`db:wipe failed: ${message}`)
  console.error('Is Postgres running? Try: pnpm db:up')
  process.exit(1)
} finally {
  await client.end()
}
