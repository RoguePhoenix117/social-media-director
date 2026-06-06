export class OperatorAuthError extends Error {
  readonly code = 'OPERATOR_AUTH_REQUIRED' as const

  constructor(message = 'Sign in required to access this page.') {
    super(message)
    this.name = 'OperatorAuthError'
  }
}

export function isOperatorAuthError(error: unknown): boolean {
  if (error instanceof OperatorAuthError) return true
  if (error instanceof Error) {
    return error.message === 'Unauthorized' || error.name === 'OperatorAuthError'
  }
  return false
}
