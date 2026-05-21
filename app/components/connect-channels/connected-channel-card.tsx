import type { PublicProjectChannel } from '../../lib/server/provider-accounts'
import { PlatformIcon } from '../platform-icons'

/**
 * Compact row representing one already-connected channel inside the
 * "Connected Channels (N)" section of the Connect Channels modal.
 */
export function ConnectedChannelCard({
  channel,
}: Readonly<{ channel: PublicProjectChannel }>) {
  const subtitle = channel.username ? `@${channel.username}` : providerLabel(channel.provider)
  return (
    <li className="connected-channel-card">
      <span className="connected-channel-avatar">
        {channel.profileImageUrl ? (
          <img alt="" src={channel.profileImageUrl} />
        ) : (
          <PlatformIcon platform={channel.provider} size={20} />
        )}
      </span>
      <span className="connected-channel-meta">
        <strong>{channel.displayName}</strong>
        <small>{subtitle}</small>
      </span>
    </li>
  )
}

function providerLabel(provider: PublicProjectChannel['provider']): string {
  return provider === 'x' ? 'X' : 'LinkedIn'
}
