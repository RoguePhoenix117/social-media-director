import { Plug } from 'lucide-react'
import { TOTAL_CHANNEL_SLOTS } from '../lib/channel-catalog'

/**
 * Persistent header control showing the active project's connected channel
 * count ("1/2 Channels"). Click reopens the Connect Channels modal so the
 * operator can connect more or replace a channel.
 *
 * Total slot count comes from `TOTAL_CHANNEL_SLOTS` (X + LinkedIn for MVP).
 */
export function ChannelProgressButton({
  connectedCount,
  onClick,
  disabled,
}: Readonly<{
  connectedCount: number
  onClick: () => void
  disabled?: boolean
}>) {
  const allConnected = connectedCount >= TOTAL_CHANNEL_SLOTS
  return (
    <button
      aria-label={`Manage channels — ${connectedCount} of ${TOTAL_CHANNEL_SLOTS} connected`}
      className={
        allConnected
          ? 'channel-progress-button channel-progress-button--complete'
          : 'channel-progress-button'
      }
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Plug aria-hidden="true" size={16} />
      <span>
        {connectedCount}/{TOTAL_CHANNEL_SLOTS} Channels
      </span>
    </button>
  )
}
