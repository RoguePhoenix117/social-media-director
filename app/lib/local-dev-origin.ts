/**
 * Local dev origin helpers. X's developer console rejects the hostname
 * `localhost` for Callback URI and Website URL — use the loopback IP instead.
 */

const DEFAULT_LOCAL_ORIGIN = 'http://127.0.0.1:5173'

/** Loopback hosts used during local development. */
export function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

/**
 * Replaces `localhost` with `127.0.0.1` in any URL string (origin or full path).
 */
export function normalizeLocalDevUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1'
    }
    return parsed.toString().replace(/\/$/, '') || parsed.origin
  } catch {
    return url.replace(/\/\/localhost(?=[:/]|$)/, '//127.0.0.1')
  }
}

/**
 * Replaces `localhost` with `127.0.0.1` so origins match what X accepts in the
 * developer console. Other hostnames are unchanged.
 */
export function normalizeLocalDevOrigin(origin: string): string {
  try {
    const url = new URL(origin)
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1'
    }
    return url.origin
  } catch {
    return origin.replace(/\/\/localhost(?=[:/]|$)/, '//127.0.0.1')
  }
}

/**
 * Resolves the app origin for OAuth callbacks and setup UI copy.
 *
 * For local dev, the live browser/request origin wins over a stale `APP_ORIGIN`
 * (Vite may print port 5173 while the tab is on 5174). Production and other
 * non-loopback hosts still prefer `APP_ORIGIN` when set.
 */
export function resolveAppOrigin(requestOrigin?: string): string {
  const normalizedRequest = requestOrigin?.trim()
    ? normalizeLocalDevOrigin(requestOrigin.trim())
    : null
  const fromEnv = process.env.APP_ORIGIN?.trim()
  const normalizedEnv = fromEnv ? normalizeLocalDevOrigin(fromEnv) : null

  if (normalizedRequest && isLocalDevOrigin(normalizedRequest)) {
    return normalizedRequest
  }
  if (normalizedEnv) return normalizedEnv
  if (normalizedRequest) return normalizedRequest
  return DEFAULT_LOCAL_ORIGIN
}

export { DEFAULT_LOCAL_ORIGIN }
