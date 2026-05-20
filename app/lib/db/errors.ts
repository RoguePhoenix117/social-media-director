const connectionErrorCodes = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ECONNRESET',
])

export function isDatabaseConnectionError(error: Error) {
  if ('code' in error && typeof error.code === 'string') {
    return connectionErrorCodes.has(error.code)
  }

  return connectionErrorCodes.has(error.message)
}
