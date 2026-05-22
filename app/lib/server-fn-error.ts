/**
 * TanStack Start dev mode can reconnect the SSR worker (e.g. after HMR) while the
 * browser keeps old server-function IDs. Calls then fail with "Invalid server
 * function ID" until a full page reload.
 */
export function isStaleServerFunctionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Invalid server function ID')
}

export function formatServerFunctionError(error: unknown): string {
  if (isStaleServerFunctionError(error)) {
    return 'The dev server reconnected. Refresh the page, then try again.'
  }
  if (error instanceof Error) return error.message
  return 'Request failed.'
}

const RELOAD_FLAG = 'smd-dev-server-fn-reload'

/** Clears the one-shot auto-reload guard after a successful navigation. */
export function clearStaleServerFunctionReloadFlag() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(RELOAD_FLAG)
}

/**
 * In dev, reload once when a stale server-function ID is detected, then show a
 * friendly message if the retry still fails.
 */
export async function invokeServerFn<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (
      import.meta.env.DEV &&
      isStaleServerFunctionError(error) &&
      typeof window !== 'undefined' &&
      !sessionStorage.getItem(RELOAD_FLAG)
    ) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
    throw error
  }
}
