import { logError, logInfo } from './logger'

export type CodexCliStatus = {
  installed: boolean
  authenticated: boolean
  message: string
}

const codexCommandTimeoutMs = 5_000

export async function getCodexCliStatus() {
  const { spawn } = await import('node:child_process')

  return new Promise<CodexCliStatus>((resolve) => {
    const child = spawn('codex', ['login', 'status'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (status: CodexCliStatus) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(status)
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      logInfo('codex_cli.status.timeout', { timeoutMs: codexCommandTimeoutMs })
      finish({
        installed: false,
        authenticated: false,
        message: 'Codex CLI status check timed out.',
      })
    }, codexCommandTimeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', () => {
      logInfo('codex_cli.status.spawn_error')
      finish({
        installed: false,
        authenticated: false,
        message: 'Codex CLI is not installed or is not available on PATH.',
      })
    })
    child.on('close', (code) => {
      const output = `${stdout}\n${stderr}`.trim()
      const authenticated = code === 0 && /logged in/i.test(output)
      finish({
        installed: code !== 127,
        authenticated,
        message: authenticated
          ? output || 'Logged in.'
          : output || 'Run codex login and choose Sign in with ChatGPT.',
      })
      if (!authenticated) {
        logError('codex_cli.status.not_authenticated', new Error(output || 'Not authenticated'), {
          code: code ?? -1,
        })
      }
    })
  })
}

export async function listCodexCliModels() {
  const { spawn } = await import('node:child_process')

  return new Promise<string[]>((resolve, reject) => {
    const child = spawn('codex', ['debug', 'models'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }

    const succeed = (models: string[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(models)
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      logInfo('codex_cli.models.timeout', { timeoutMs: codexCommandTimeoutMs })
      fail(new Error('Codex CLI model listing timed out.'))
    }, codexCommandTimeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      logError('codex_cli.models.spawn_error', error)
      fail(new Error('Codex CLI is not installed or is not available on PATH.'))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        const message = `${stderr}\n${stdout}`.trim() || 'Codex CLI could not list models.'
        fail(new Error(message))
        return
      }

      try {
        const payload = JSON.parse(stdout) as {
          models?: Array<{ slug?: string; visibility?: string }>
        }
        const modelIds = (payload.models ?? [])
          .filter((model) => model.visibility === 'list' || model.slug)
          .map((model) => model.slug)
          .filter((slug): slug is string => Boolean(slug))
          .sort((left, right) => left.localeCompare(right))

        if (!modelIds.length) {
          fail(new Error('Codex CLI returned an empty model catalog.'))
          return
        }

        succeed(modelIds)
      } catch (error) {
        logError('codex_cli.models.parse_error', error)
        fail(new Error('Codex CLI returned an unreadable model catalog.'))
      }
    })
  })
}
