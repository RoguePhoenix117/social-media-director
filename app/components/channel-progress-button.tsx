import { Plug } from 'lucide-react'

/**
 * Persistent header control showing the active project's connected channel
 * count ("1/M Channels"). M reflects how many OAuth apps the deployer enabled.
 */
export function ChannelProgressButton({
  connectedCount,
  onClick,
  disabled,
  totalSlots,
}: Readonly<{
  connectedCount: number
  onClick: () => void
  disabled?: boolean
  totalSlots: number
}>) {
  const allConnected = totalSlots > 0 && connectedCount >= totalSlots
  return (
    <button
      aria-label={`Manage channels — ${connectedCount} of ${totalSlots} connected`}
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
        {connectedCount}/{totalSlots} Channels
      </span>
    </button>
  )
}
