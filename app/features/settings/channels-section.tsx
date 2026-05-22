import { Plug } from 'lucide-react'
import { useState } from 'react'
import { ChannelProgressButton } from '../../components/channel-progress-button'
import { ConnectChannelsModal } from '../../components/connect-channels/connect-channels-modal'
import { ConnectedChannelCard } from '../../components/connect-channels/connected-channel-card'
import type { PublicProjectChannel } from '../../lib/server/provider-accounts'
import { countEnabledChannelSlots, type InstanceOAuthProviders } from '../../lib/channel-catalog'

/**
 * Settings → Channels card. Channels are connected exclusively via OAuth
 * through the Connect Channels modal — no developer portal or token paste.
 */
export function ChannelsSection({
  activeProjectId,
  connectedChannels,
  instanceOAuthProviders,
}: Readonly<{
  activeProjectId: string | null
  connectedChannels: PublicProjectChannel[]
  instanceOAuthProviders: InstanceOAuthProviders
}>) {
  const [open, setOpen] = useState(false)
  const totalChannelSlots = countEnabledChannelSlots(instanceOAuthProviders)

  return (
    <>
      <section
        className="template-card settings-section channels-settings-section"
        id="channels"
      >
        <div className="panel-heading">
          <Plug aria-hidden="true" size={22} />
          <div>
            <h2>Connected channels</h2>
            <p>
              {totalChannelSlots > 0
                ? 'Click Manage channels to sign in on X or LinkedIn and authorize — OAuth only, no API keys or developer console needed.'
                : 'No OAuth apps are configured on this instance. The instance owner can add X or LinkedIn in Developers settings.'}
            </p>
          </div>
        </div>

        {connectedChannels.length > 0 ? (
          <ul className="connected-channel-list connected-channel-list--settings">
            {connectedChannels.map((channel) => (
              <ConnectedChannelCard channel={channel} key={channel.id} />
            ))}
          </ul>
        ) : (
          <p className="setup-copy">
            {totalChannelSlots > 0
              ? 'No channels connected yet. Open the modal to start an OAuth connection.'
              : 'Channel connection is unavailable until the instance owner registers OAuth credentials.'}
          </p>
        )}

        <div className="button-row">
          {totalChannelSlots > 0 ? (
            <ChannelProgressButton
              connectedCount={connectedChannels.length}
              disabled={!activeProjectId}
              onClick={() => setOpen(true)}
              totalSlots={totalChannelSlots}
            />
          ) : null}
          {!activeProjectId ? (
            <p className="setup-copy" role="status">
              Create a project from the dashboard onboarding to manage channels.
            </p>
          ) : null}
        </div>
      </section>

      <ConnectChannelsModal
        connectedChannels={connectedChannels}
        instanceOAuthProviders={instanceOAuthProviders}
        onClose={() => setOpen(false)}
        onContinue={() => setOpen(false)}
        open={open}
      />
    </>
  )
}
