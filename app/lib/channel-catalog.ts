/**
 * Channel catalog — single source of truth for the Connect Channels grid.
 *
 * Active providers (`status: 'active'`) wire up to the OAuth start route at
 * `/integrations/social/{provider}`. Coming-soon tiles render disabled so
 * the grid keeps visual parity with the Postiz-style reference UI while we
 * ship one provider at a time.
 *
 * PR4: X active. LinkedIn shown as "Coming soon" until PR5 lands its OAuth
 * flow — flip its status to `active` there.
 */

export type ChannelStatus = 'active' | 'coming_soon'

export type ChannelCatalogEntry = {
  id: string
  label: string
  status: ChannelStatus
  /** Lowercase identifier passed to PlatformIcon. */
  iconKey: string
  /** OAuth start route. Required when status is 'active'. */
  startHref?: string
}

export const CHANNEL_CATALOG: ReadonlyArray<ChannelCatalogEntry> = [
  { id: 'x', label: 'X', status: 'active', iconKey: 'x', startHref: '/integrations/social/x' },
  { id: 'linkedin', label: 'LinkedIn', status: 'coming_soon', iconKey: 'linkedin' },
  { id: 'linkedin-page', label: 'LinkedIn Page', status: 'coming_soon', iconKey: 'linkedin' },
  { id: 'reddit', label: 'Reddit', status: 'coming_soon', iconKey: 'reddit' },
  { id: 'instagram-fb', label: 'Instagram (Facebook Business)', status: 'coming_soon', iconKey: 'instagram' },
  { id: 'instagram', label: 'Instagram (Standalone)', status: 'coming_soon', iconKey: 'instagram' },
  { id: 'facebook', label: 'Facebook Page', status: 'coming_soon', iconKey: 'facebook' },
  { id: 'threads', label: 'Threads', status: 'coming_soon', iconKey: 'threads' },
  { id: 'youtube', label: 'YouTube', status: 'coming_soon', iconKey: 'youtube' },
  { id: 'gmb', label: 'Google My Business', status: 'coming_soon', iconKey: 'gmb' },
  { id: 'tiktok', label: 'TikTok', status: 'coming_soon', iconKey: 'tiktok' },
  { id: 'pinterest', label: 'Pinterest', status: 'coming_soon', iconKey: 'pinterest' },
  { id: 'dribbble', label: 'Dribbble', status: 'coming_soon', iconKey: 'dribbble' },
  { id: 'discord', label: 'Discord', status: 'coming_soon', iconKey: 'discord' },
  { id: 'slack', label: 'Slack', status: 'coming_soon', iconKey: 'slack' },
  { id: 'mastodon', label: 'Mastodon', status: 'coming_soon', iconKey: 'mastodon' },
  { id: 'bluesky', label: 'Bluesky', status: 'coming_soon', iconKey: 'bluesky' },
  { id: 'farcaster', label: 'Farcaster', status: 'coming_soon', iconKey: 'farcaster' },
  { id: 'telegram', label: 'Telegram', status: 'coming_soon', iconKey: 'telegram' },
  { id: 'medium', label: 'Medium', status: 'coming_soon', iconKey: 'medium' },
  { id: 'devto', label: 'Dev.to', status: 'coming_soon', iconKey: 'devto' },
  { id: 'hashnode', label: 'Hashnode', status: 'coming_soon', iconKey: 'hashnode' },
  { id: 'wordpress', label: 'WordPress', status: 'coming_soon', iconKey: 'wordpress' },
] as const

/** Providers that we may receive in `provider_accounts.provider`. */
export type ConnectableProvider = 'x' | 'linkedin'

export function getActiveCatalogEntry(provider: ConnectableProvider): ChannelCatalogEntry | undefined {
  return CHANNEL_CATALOG.find((entry) => entry.id === provider && entry.status === 'active')
}

/**
 * Number of provider slots that count towards the "N/M channels" progress
 * shown in the dashboard. Today this is X + LinkedIn (MVP); LinkedIn counts
 * even while the tile is "Coming soon" so the progress badge already shows
 * `0/2` and updates automatically when PR5 flips LinkedIn to active.
 */
export const TOTAL_CHANNEL_SLOTS = 2 as const
