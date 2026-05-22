import { Link } from '@tanstack/react-router'
import { Bot, Link2, PenLine, Send, SlidersHorizontal } from 'lucide-react'
import type { PublicSettingsStatus } from '../../lib/server/settings'

type StatusCard = {
  label: string
  value: string
  isReady: boolean
  icon: typeof Bot
  action?: { label: string; to: string; hash?: string }
}

export function DashboardStatusGrid({
  settings,
  draftCount,
  onChannelsClick,
}: Readonly<{
  settings: PublicSettingsStatus | null
  draftCount: number
  onChannelsClick: () => void
}>) {
  const cards = buildCards(settings, draftCount)

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
          ) : card.label === 'X publishing' || card.label === 'LinkedIn' ? (
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

function buildCards(settings: PublicSettingsStatus | null, draftCount: number): StatusCard[] {
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
      value: settings?.xConfigured ? 'Connected' : 'Not connected',
      isReady: Boolean(settings?.xConfigured),
      icon: Send,
    },
    {
      label: 'LinkedIn',
      value: settings?.linkedinConfigured ? 'Connected' : 'Not connected',
      isReady: Boolean(settings?.linkedinConfigured),
      icon: Link2,
    },
    {
      label: 'Drafts generated',
      value: draftCount ? String(draftCount) : '0',
      isReady: draftCount > 0,
      icon: PenLine,
    },
  ]
}

function aiModelStatusValue(settings: PublicSettingsStatus | null) {
  if (!settings?.modelConfigured) return 'Missing'
  if (settings.activeAiBackendType === 'codexCli') {
    return `Ready: Codex CLI / ${settings.codexCliModel ?? 'model'}`
  }
  if (settings.activeAiBackendType === 'openaiApiKey') {
    return `Ready: OpenAI API / ${settings.openaiModel ?? 'model'}`
  }
  return 'Configured'
}
