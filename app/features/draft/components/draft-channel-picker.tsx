import { Globe } from 'lucide-react'
import type { Provider } from '../../../lib/domain/providers'
import type { PublicProjectChannel } from '../../../lib/server/provider-accounts'
import { PlatformIcon } from '../../../components/platform-icons'

export type DraftEditorTarget = 'global' | Provider

type DraftChannelPickerProps = {
  channels: PublicProjectChannel[]
  activeTarget: DraftEditorTarget
  variantProviders: Provider[]
  onSelect: (target: DraftEditorTarget) => void
}

export function DraftChannelPicker({
  channels,
  activeTarget,
  variantProviders,
  onSelect,
}: Readonly<DraftChannelPickerProps>) {
  const channelsWithVariants = channels.filter((channel) =>
    variantProviders.includes(channel.provider),
  )

  return (
    <div className="draft-channel-picker" role="toolbar" aria-label="Edit target">
      <button
        aria-label="Global post copy"
        aria-pressed={activeTarget === 'global'}
        className={`draft-channel-chip global ${activeTarget === 'global' ? 'active' : ''}`}
        onClick={() => onSelect('global')}
        type="button"
      >
        <Globe aria-hidden="true" size={18} />
        <span>Global</span>
      </button>
      {channelsWithVariants.map((channel) => (
        <button
          aria-label={`Edit ${providerLabel(channel.provider)} copy`}
          aria-pressed={activeTarget === channel.provider}
          className={`draft-channel-chip ${activeTarget === channel.provider ? 'active' : ''}`}
          key={channel.id}
          onClick={() => onSelect(channel.provider)}
          type="button"
        >
          <span className="draft-channel-avatar">
            {channel.profileImageUrl ? (
              <img alt="" src={channel.profileImageUrl} />
            ) : (
              <PlatformIcon platform={channel.provider} size={18} />
            )}
          </span>
          <span className="draft-channel-chip-label">{providerLabel(channel.provider)}</span>
        </button>
      ))}
    </div>
  )
}

function providerLabel(provider: Provider) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}
