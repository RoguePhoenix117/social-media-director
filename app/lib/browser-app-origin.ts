import { normalizeLocalDevOrigin } from './local-dev-origin'

export type ProviderCallbackUrls = {
  x: string
  linkedin: string
}

/**
 * Reads the origin of the page the user actually opened. Safe to call during SSR
 * (returns null when `window` is unavailable).
 */
export function readBrowserAppOrigin(): string | null {
  if (typeof window === 'undefined') return null
  return normalizeLocalDevOrigin(window.location.origin)
}

export function buildProviderCallbackUrls(origin: string): ProviderCallbackUrls {
  const normalized = normalizeLocalDevOrigin(origin)
  return {
    x: `${normalized}/integrations/social/x/callback`,
    linkedin: `${normalized}/integrations/social/linkedin/callback`,
  }
}

export function resolveProviderCallbackUrl(
  browserOrigin: string | null,
  serverCallbackUrl: string,
  provider: 'x' | 'linkedin',
): string {
  if (browserOrigin) return buildProviderCallbackUrls(browserOrigin)[provider]
  return serverCallbackUrl
}

export function originFromUrl(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}
