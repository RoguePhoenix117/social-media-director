import { Check } from 'lucide-react'
import type { ChannelCatalogEntry } from '../../lib/channel-catalog'
import { PlatformIcon } from '../platform-icons'

/**
 * Single platform tile inside the Connect Channels grid.
 *
 * - `active` + not connected → anchor `<a>` linking to the OAuth start route.
 *   We use a plain `<a>` (not router `<Link>`) because the start route is a
 *   loader that throws `redirect()` to the provider; we want a full
 *   navigation, not a router transition.
 * - `active` + connected → disabled with a checkmark badge.
 * - `coming_soon` → disabled with a "Coming soon" badge.
 */
export function ChannelTile({
  entry,
  isConnected,
}: Readonly<{
  entry: ChannelCatalogEntry
  isConnected: boolean
}>) {
  const isActive = entry.status === 'active'
  const isClickable = isActive && !isConnected && Boolean(entry.startHref)

  const badge = isConnected ? (
    <span aria-label="Connected" className="channel-tile-badge channel-tile-badge--connected">
      <Check aria-hidden="true" size={12} />
    </span>
  ) : entry.status === 'coming_soon' ? (
    <span className="channel-tile-badge channel-tile-badge--soon">Soon</span>
  ) : null

  const inner = (
    <>
      <div className="channel-tile-icon">
        <PlatformIcon platform={entry.iconKey} size={28} />
      </div>
      <span className="channel-tile-label">{entry.label}</span>
      {badge}
    </>
  )

  if (isClickable && entry.startHref) {
    return (
      <a
        aria-label={`Connect ${entry.label}`}
        className="channel-tile channel-tile--active"
        href={entry.startHref}
      >
        {inner}
      </a>
    )
  }

  return (
    <div
      aria-disabled="true"
      aria-label={
        isConnected ? `${entry.label} is already connected` : `${entry.label} coming soon`
      }
      className={
        isConnected
          ? 'channel-tile channel-tile--connected'
          : 'channel-tile channel-tile--disabled'
      }
      title={isConnected ? 'Already connected' : 'Coming soon'}
    >
      {inner}
    </div>
  )
}
