import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, Link2, Send } from 'lucide-react'
import { AiWorkspace } from '../../components/ai-workspace'
import { AppearanceSettings } from '../../components/appearance-settings'
import { AppLayout } from '../../components/app-layout'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import type { getSettingsPageState } from '../../server/settings'
import { ChannelsSection } from './channels-section'
import { DevelopersSection } from './developers-section'
import { settingsPageQueryKey, settingsPageQueryOptions } from './settings-query'

type SettingsPageState = Awaited<ReturnType<typeof getSettingsPageState>>

export function SettingsPage({ initialState }: Readonly<{ initialState: SettingsPageState }>) {
  const queryClient = useQueryClient()
  const { data: pageState } = useQuery({
    ...settingsPageQueryOptions(),
    initialData: initialState,
  })
  const settings = pageState.settings
  const operatorName = pageState.operatorFirstName
    ? pageState.operatorFirstName
    : pageState.operatorEmail

  async function onSettingsChanged(nextSettings: PublicSettingsStatus) {
    queryClient.setQueryData(settingsPageQueryKey, { ...pageState, settings: nextSettings })
    await queryClient.invalidateQueries({
      queryKey: settingsPageQueryKey,
      refetchType: 'all',
    })
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey, refetchType: 'all' })
  }

  return (
    <AppLayout operatorName={operatorName}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Configuration and appearance</h1>
          <p className="page-summary">
            Manage AI generation, OAuth app credentials, and connected channels. All
            secrets are encrypted in your local database.
          </p>
        </div>
      </header>

      <section className="stats-grid settings-status-grid" aria-label="Configuration status">
        <StatusCard configured={settings.modelConfigured} icon={Bot} label="AI model" />
        <StatusCard configured={settings.xConfigured} icon={Send} label="X publishing" />
        <StatusCard configured={settings.linkedinConfigured} icon={Link2} label="LinkedIn" />
      </section>

      <div className="settings-page-grid">
        <AiWorkspace
          codexCli={pageState.codexCli}
          onSaved={(nextSettings) => void onSettingsChanged(nextSettings)}
          settings={settings}
        />

        <DevelopersSection isInstanceOwner={pageState.isInstanceOwner} />

        <ChannelsSection
          activeProjectId={pageState.activeProjectId}
          connectedChannels={pageState.connectedChannels}
        />
      </div>

      <AppearanceSettings />
    </AppLayout>
  )
}

function StatusCard({
  configured,
  icon: Icon,
  label,
}: Readonly<{
  configured: boolean
  icon: typeof Bot
  label: string
}>) {
  return (
    <article className="stat-card">
      <div className={configured ? 'stat-icon ready' : 'stat-icon'}>
        <Icon aria-hidden="true" size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{configured ? 'Configured' : 'Missing'}</strong>
      </div>
      {configured ? <CheckCircle2 aria-hidden="true" className="status-check" size={19} /> : null}
    </article>
  )
}
