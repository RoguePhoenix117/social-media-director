import { Plug } from 'lucide-react'
import { useState } from 'react'
import { ChannelProgressButton } from '../../components/channel-progress-button'
import { ConnectChannelsModal } from '../../components/connect-channels/connect-channels-modal'
import { ConnectedChannelCard } from '../../components/connect-channels/connected-channel-card'
import type { PublicProjectChannel } from '../../lib/server/provider-accounts'

/**
 * Settings → Channels card. Replaces the legacy paste form removed in PR4:
 * channels are now connected exclusively via OAuth through the Connect
 * Channels modal.
 */
export function ChannelsSection({
  activeProjectId,
  connectedChannels,
}: Readonly<{
  activeProjectId: string | null
  connectedChannels: PublicProjectChannel[]
}>) {
  const [open, setOpen] = useState(false)

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
              Connect your X and LinkedIn accounts via OAuth. Tokens stay encrypted in
              your local database.
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
            No channels connected yet. Open the modal to start an OAuth connection.
          </p>
        )}

        <div className="button-row">
          <ChannelProgressButton
            connectedCount={connectedChannels.length}
            disabled={!activeProjectId}
            onClick={() => setOpen(true)}
          />
          {!activeProjectId ? (
            <p className="setup-copy" role="status">
              Create a project from the dashboard onboarding to manage channels.
            </p>
          ) : null}
        </div>
      </section>

      <ConnectChannelsModal
        connectedChannels={connectedChannels}
        onClose={() => setOpen(false)}
        onContinue={() => setOpen(false)}
        open={open}
      />
    </>
  )
}
