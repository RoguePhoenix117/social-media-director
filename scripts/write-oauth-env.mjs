#!/usr/bin/env node
/**
 * Merge OAuth app credentials into the project-root `.env` without touching
 * unrelated lines. Creates `.env` from `.env.example` when missing.
 *
 * Usage:
 *   node --experimental-strip-types scripts/write-oauth-env.mjs \
 *     --x-client-id=... --x-client-secret=... \
 *     --linkedin-client-id=... --linkedin-client-secret=...
 *
 * Clear a key (remove its line):
 *   node --experimental-strip-types scripts/write-oauth-env.mjs --clear-x-client-id
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mergeOAuthEnvContent } from '../app/lib/oauth-env-file.ts'

const ARG_TO_ENV = {
  'x-client-id': 'X_CLIENT_ID',
  'x-client-secret': 'X_CLIENT_SECRET',
  'linkedin-client-id': 'LINKEDIN_CLIENT_ID',
  'linkedin-client-secret': 'LINKEDIN_CLIENT_SECRET',
}

const CLEAR_FLAGS = new Set([
  'clear-x-client-id',
  'clear-x-client-secret',
  'clear-linkedin-client-id',
  'clear-linkedin-client-secret',
])

function parseArgs(argv) {
  const updates = {}
  let envFile = join(process.cwd(), '.env')

  for (const arg of argv) {
    if (arg.startsWith('--env-file=')) {
      envFile = arg.slice('--env-file='.length)
      continue
    }

    if (arg.startsWith('--clear-')) {
      const flag = arg.slice(2)
      if (!CLEAR_FLAGS.has(flag)) {
        console.error(`Unknown flag: ${arg}`)
        process.exit(1)
      }
      const envKey = ARG_TO_ENV[flag.replace(/^clear-/, '')]
      updates[envKey] = null
      continue
    }

    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq === -1) {
      console.error(`Expected KEY=value form: ${arg}`)
      process.exit(1)
    }
    const name = arg.slice(2, eq)
    const envKey = ARG_TO_ENV[name]
    if (!envKey) {
      console.error(`Unknown option: --${name}`)
      process.exit(1)
    }
    updates[envKey] = arg.slice(eq + 1)
  }

  return { envFile, updates }
}

function readBootstrap(envFilePath) {
  if (existsSync(envFilePath)) {
    return readFileSync(envFilePath, 'utf8')
  }
  const examplePath = join(dirname(envFilePath), '.env.example')
  if (existsSync(examplePath)) {
    return readFileSync(examplePath, 'utf8')
  }
  return '# OAuth credentials — see docs/developer-oauth-setup.md\n'
}

const { envFile, updates } = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'))
if (Object.keys(updates).length === 0) {
  console.error('No OAuth env updates provided. Pass --x-client-id=... etc.')
  process.exit(1)
}

const merged = mergeOAuthEnvContent(readBootstrap(envFile), updates)
const tmpPath = `${envFile}.tmp.${process.pid}`
writeFileSync(tmpPath, merged, { encoding: 'utf8', mode: 0o600 })
renameSync(tmpPath, envFile)

console.log(`Updated ${envFile}`)
console.log(`Keys touched: ${Object.keys(updates).join(', ')}`)
console.log('Restart the dev server so process.env picks up any new values.')
