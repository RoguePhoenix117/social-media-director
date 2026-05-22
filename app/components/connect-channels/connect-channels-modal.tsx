import { ArrowRight, X as XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  CHANNEL_CATALOG,
  countEnabledChannelSlots,
  isInstanceProviderEnabled,
  type ConnectableProvider,
  type InstanceOAuthProviders,
} from '../../lib/channel-catalog'
import type { PublicProjectChannel } from '../../lib/server/provider-accounts'
import { ChannelTile } from './channel-tile'
import { ConnectedChannelCard } from './connected-channel-card'

/**
 * Postiz-style centered modal for connecting OAuth channels to the active
 * project. The modal is intentionally NOT full-viewport (see plan.md PR4
 * UX spec). Dismiss paths:
 *
 *  - Click outside the panel (backdrop)
 *  - X button (top-right)
 *  - "Continue without channels" / "Continue" (bottom-right)
 *  - Escape key
 *
 * The caller owns open state and the `onContinue` handler — for onboarding
 * this advances the wizard, for the dashboard it closes the modal.
 */
export function ConnectChannelsModal({
  open,
  onClose,
  onContinue,
  connectedChannels,
  instanceOAuthProviders,
  variant = 'standalone',
}: Readonly<{
  open: boolean
  onClose: () => void
  onContinue: () => void
  connectedChannels: PublicProjectChannel[]
  /** OAuth apps registered by the deployer — unavailable providers cannot connect. */
  instanceOAuthProviders: InstanceOAuthProviders
  /**
   * `onboarding` swaps the continue label from "Continue" to either
   * "Continue without channels" (none connected) or "Continue".
   */
  variant?: 'standalone' | 'onboarding'
}>) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const connectedProviders = new Set<ConnectableProvider>(
    connectedChannels.map((channel) => channel.provider),
  )
  const enabledSlotCount = countEnabledChannelSlots(instanceOAuthProviders)
  const continueLabel =
    variant === 'onboarding' && connectedChannels.length === 0
      ? 'Continue without channels'
      : 'Continue'

  return (
    <div
      aria-labelledby="connect-channels-title"
      aria-modal="true"
      className="modal-backdrop connect-channels-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <section className="connect-channels-modal" ref={panelRef}>
        <button
          aria-label="Close connect channels"
          className="icon-button connect-channels-close"
          onClick={onClose}
          type="button"
        >
          <XIcon aria-hidden="true" size={18} />
        </button>

        <header className="connect-channels-header">
          <p className="eyebrow">Channels</p>
          <h2 id="connect-channels-title">Connect Your Channels</h2>
          <p>
            {enabledSlotCount > 0
              ? 'Sign in on X or LinkedIn and click Authorize — no developer portal, no API keys, and nothing to paste here.'
              : 'No social OAuth apps are configured on this instance. The deployer can add X or LinkedIn later in Settings → Developers.'}
          </p>
        </header>

        {enabledSlotCount === 0 ? (
          <p className="setup-copy connect-channels-empty-notice" role="status">
            Channel connection is unavailable until the instance owner registers at least one
            OAuth app.
          </p>
        ) : null}

        {connectedChannels.length > 0 ? (
          <section
            aria-label="Connected channels"
            className="connect-channels-connected-section"
          >
            <h3>Connected Channels ({connectedChannels.length})</h3>
            <ul className="connected-channel-list">
              {connectedChannels.map((channel) => (
                <ConnectedChannelCard channel={channel} key={channel.id} />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Available channels">
          <h3 className="connect-channels-grid-heading">Click a channel to add it</h3>
          <div className="connect-channels-grid">
            {CHANNEL_CATALOG.map((entry) => (
              <ChannelTile
                entry={entry}
                instanceOAuthEnabled={
                  entry.id === 'x' || entry.id === 'linkedin'
                    ? isInstanceProviderEnabled(instanceOAuthProviders, entry.id)
                    : true
                }
                isConnected={isConnectedEntry(entry.id, connectedProviders)}
                key={entry.id}
              />
            ))}
          </div>
        </section>

        <footer className="connect-channels-footer">
          <button className="primary-button" onClick={onContinue} type="button">
            {continueLabel}
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </footer>
      </section>
    </div>
  )
}

function isConnectedEntry(
  entryId: string,
  connectedProviders: Set<ConnectableProvider>,
): boolean {
  return entryId === 'x' || entryId === 'linkedin'
    ? connectedProviders.has(entryId)
    : false
}
