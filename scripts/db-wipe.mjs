#!/usr/bin/env node
/**
 * Wipe all rows from every public table while keeping the schema.
 *
 * Usage:
 *   pnpm db:wipe
 *   pnpm db:wipe -- --reset-setup
 *
 * `--reset-setup` also removes deployer OAuth keys from `.env` so `/setup` is
 * reachable again (OAuth app credentials are env-only, not stored in Postgres).
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { mergeOAuthEnvContent } from '../app/lib/oauth-env-file.ts'

const { Client } = pg

const resetSetup = process.argv.includes('--reset-setup')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required. Copy .env.example to .env or set DATABASE_URL.')
  process.exit(1)
}

const client = new Client({ connectionString: databaseUrl })

async function listPublicTables() {
  const { rows } = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `)
  return rows.map((row) => row.tablename)
}

async function countRows(tableNames) {
  const counts = {}
  for (const tablename of tableNames) {
    const { rows } = await client.query(`select count(*)::int as n from "${tablename}"`)
    counts[tablename] = rows[0].n
  }
  return counts
}

async function wipeDatabase(tableNames) {
  await client.query('begin')
  try {
    if (tableNames.length > 0) {
      const tableList = tableNames.map((name) => `"${name}"`).join(', ')
      await client.query(`truncate table ${tableList} restart identity cascade`)
    }

    // Migrations seed this singleton row; TRUNCATE removes it.
    await client.query(`
      insert into instance_meta (id, configured, setup_completed_at)
      values (1, false, null)
    `)

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

function clearDeployerOAuthEnv() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return { envPath, cleared: false }
  }

  const merged = mergeOAuthEnvContent(readFileSync(envPath, 'utf8'), {
    X_CLIENT_ID: null,
    X_CLIENT_SECRET: null,
    LINKEDIN_CLIENT_ID: null,
    LINKEDIN_CLIENT_SECRET: null,
  })

  const tmpPath = `${envPath}.tmp.${process.pid}`
  writeFileSync(tmpPath, merged, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmpPath, envPath)

  return { envPath, cleared: true }
}

function sumCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0)
}

try {
  await client.connect()

  const tableNames = await listPublicTables()
  if (!tableNames.length) {
    console.log('No public tables found. Run pnpm db:up (or pnpm db:reset) first.')
    process.exit(0)
  }

  const before = await countRows(tableNames)
  const rowsBefore = sumCounts(before)

  await wipeDatabase(tableNames)

  const after = await countRows(tableNames)
  const rowsAfter = sumCounts(after)

  console.log(`Database wiped: ${tableNames.length} tables truncated, schema kept.`)
  console.log(`Rows before: ${rowsBefore} → after: ${rowsAfter}`)
  if (rowsBefore > 0) {
    const nonEmpty = Object.entries(before)
      .filter(([, count]) => count > 0)
      .map(([table, count]) => `${table} (${count})`)
    if (nonEmpty.length) {
      console.log(`Cleared: ${nonEmpty.join(', ')}`)
    }
  }
  console.log('instance_meta reset to configured=false.')

  if (resetSetup) {
    const { envPath, cleared } = clearDeployerOAuthEnv()
    if (cleared) {
      console.log(`Deployer OAuth keys removed from ${envPath}.`)
      console.log('Restart pnpm dev, then open /setup to run the developer wizard again.')
    } else {
      console.log('No .env file found — skipped OAuth env reset.')
    }
  } else if (process.env.X_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID) {
    console.log('')
    console.log(
      'Note: OAuth app credentials remain in .env, so /setup stays closed until they are cleared.',
    )
    console.log('For a full developer-wizard reset, run: pnpm db:wipe -- --reset-setup')
  }

  if (rowsAfter > 1) {
    console.warn('')
    console.warn(`Warning: expected at most 1 row (instance_meta), but ${rowsAfter} remain.`)
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`db:wipe failed: ${message}`)
  console.error('Is Postgres running? Try: pnpm db:up')
  process.exit(1)
} finally {
  await client.end()
}
