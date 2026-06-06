const HOTLINK_RISKY_HOSTS = ['opengraph.githubassets.com'] as const

export function isBrowserHotlinkRiskyImageUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return HOTLINK_RISKY_HOSTS.some(
      (risky) => host === risky || host.endsWith(`.${risky}`),
    )
  } catch {
    return false
  }
}

export function sanitizePreviewImageUrl(url: string | undefined): string | undefined {
  if (!url || isBrowserHotlinkRiskyImageUrl(url)) return undefined
  return url
}
