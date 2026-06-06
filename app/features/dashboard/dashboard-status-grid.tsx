import { Link } from '@tanstack/react-router'
import { Bot, Link2, PenLine, Send, SlidersHorizontal } from 'lucide-react'
import type { InstanceOAuthProviders } from '../../lib/channel-catalog'
import type { PublicSettingsStatus } from '../../lib/server/settings'

type StatusCard = {
  label: string
  value: string
  isReady: boolean
  icon: typeof Bot
  manageable?: boolean
  action?: { label: string; to: string; hash?: string }
}

export function DashboardStatusGrid({
  settings,
  draftCount,
  instanceOAuthProviders,
  onChannelsClick,
}: Readonly<{
  settings: PublicSettingsStatus | null
  draftCount: number
  instanceOAuthProviders: InstanceOAuthProviders
  onChannelsClick: () => void
}>) {
  const cards = buildCards(settings, draftCount, instanceOAuthProviders)

  return (
    <section aria-label="Integration status" className="stats-grid">
      {cards.map((card) => (
        <article className="stat-card" key={card.label}>
          <div className={card.isReady ? 'stat-icon ready' : 'stat-icon'}>
            <card.icon aria-hidden="true" size={22} />
          </div>
          <div>
            <p>{card.label}</p>
            <strong className={card.isReady ? 'status-value ready' : 'status-value'}>
              {card.value}
            </strong>
          </div>
          {card.action ? (
            <Link
              aria-label={card.action.label}
              className="stat-card-action"
              hash={card.action.hash}
              to={card.action.to}
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              <span>{card.action.label}</span>
            </Link>
          ) : (card.label === 'X publishing' || card.label === 'LinkedIn') &&
            card.manageable !== false ? (
            <button
              aria-label={`Manage ${card.label}`}
              className="stat-card-action stat-card-action--button"
              onClick={onChannelsClick}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              <span>Manage</span>
            </button>
          ) : null}
        </article>
      ))}
    </section>
  )
}

function buildCards(
  settings: PublicSettingsStatus | null,
  draftCount: number,
  instanceOAuthProviders: InstanceOAuthProviders,
): StatusCard[] {
  return [
    {
      label: 'AI model',
      value: aiModelStatusValue(settings),
      isReady: Boolean(settings?.modelConfigured),
      icon: Bot,
      action: { label: 'AI settings', to: '/settings', hash: 'ai-workspace' },
    },
    {
      label: 'X publishing',
      value: channelStatusValue(settings?.xConfigured, instanceOAuthProviders.x),
      isReady: Boolean(instanceOAuthProviders.x && settings?.xConfigured),
      icon: Send,
      manageable: instanceOAuthProviders.x,
    },
    {
      label: 'LinkedIn',
      value: channelStatusValue(settings?.linkedinConfigured, instanceOAuthProviders.linkedin),
      isReady: Boolean(instanceOAuthProviders.linkedin && settings?.linkedinConfigured),
      icon: Link2,
      manageable: instanceOAuthProviders.linkedin,
    },
    {
      label: 'Drafts generated',
      value: draftCount ? String(draftCount) : '0',
      isReady: draftCount > 0,
      icon: PenLine,
      action: { label: 'Open drafts', to: '/draft' },
    },
  ]
}

function channelStatusValue(connected: boolean | undefined, enabledOnInstance: boolean) {
  if (!enabledOnInstance) return 'Not enabled on instance'
  return connected ? 'Connected' : 'Not connected'
}

function aiModelStatusValue(settings: PublicSettingsStatus | null) {
  if (!settings?.modelConfigured) return 'Missing'
  if (settings.activeAiBackendType === 'template') {
    return 'Ready: Template mode'
  }
  if (settings.activeAiBackendType === 'codexCli') {
    return `Ready: Codex CLI / ${settings.codexCliModel ?? 'model'}`
  }
  if (settings.activeAiBackendType === 'ollama') {
    return `Ready: Ollama / ${settings.ollamaModel ?? 'model'}`
  }
  if (settings.activeAiBackendType === 'openaiCompatible') {
    const label = settings.openaiCompatibleProviderName ?? 'OpenAI-compatible'
    return `Ready: ${label} / ${settings.openaiCompatibleModel ?? 'model'}`
  }
  if (settings.activeAiBackendType === 'openaiApiKey') {
    return `Ready: OpenAI API / ${settings.openaiModel ?? 'model'}`
  }
  return 'Configured'
}
