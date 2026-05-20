type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogFields = Record<string, boolean | number | string | null | undefined>

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = parseLevel(process.env.LOG_LEVEL)

export function logInfo(event: string, fields: LogFields = {}) {
  writeLog('info', event, fields)
}

export function logWarn(event: string, fields: LogFields = {}) {
  writeLog('warn', event, fields)
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  writeLog('error', event, {
    ...fields,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  })
}

function writeLog(level: LogLevel, event: string, fields: LogFields) {
  if (levelRank[level] < levelRank[configuredLevel]) return

  const payload = {
    time: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

function parseLevel(value: string | undefined): LogLevel {
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value
  }
  return 'info'
}

function redact(fields: LogFields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (/key|token|secret|password|authorization/i.test(key)) {
        return [key, value ? '[redacted]' : value]
      }
      return [key, value]
    }),
  )
}
