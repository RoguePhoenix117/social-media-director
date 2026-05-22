import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Bot, CheckCircle2, Link2, Send } from 'lucide-react'
import { useState } from 'react'
import { AiWorkspace } from '../../components/ai-workspace'
import { AppearanceSettings } from '../../components/appearance-settings'
import { AppLayout } from '../../components/app-layout'
import { ConnectChannelsModal } from '../../components/connect-channels/connect-channels-modal'
import { ProjectSwitcher } from '../../components/project-switcher'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import { createProject, setActiveProject } from '../../server/projects'
import type { getSettingsPageState } from '../../server/settings'
import { ChannelsSection } from './channels-section'
import { DevelopersSection } from './developers-section'
import { ProjectsSection } from './projects-section'
import { settingsPageQueryKey, settingsPageQueryOptions } from './settings-query'

type SettingsPageState = Awaited<ReturnType<typeof getSettingsPageState>>

export function SettingsPage({ initialState }: Readonly<{ initialState: SettingsPageState }>) {
  const queryClient = useQueryClient()
  const { data: pageState } = useQuery({
    ...settingsPageQueryOptions(),
    initialData: initialState,
  })
  const createProjectFn = useServerFn(createProject)
  const setActiveProjectFn = useServerFn(setActiveProject)
  const [channelsModalOpen, setChannelsModalOpen] = useState(false)

  const settings = pageState.settings
  const totalChannelSlots = countEnabledChannelSlots(pageState.instanceOAuthProviders)
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

  async function refreshAfterProjectChange(opts: { autoOpenIfEmpty: boolean }) {
    // Refresh BOTH the settings page state (the source of truth for the
    // ProjectsSection list + active project) and the bootstrap state (used by
    // the dashboard topbar + ProjectSwitcher across routes).
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsPageQueryKey, refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey, refetchType: 'all' }),
    ])

    if (opts.autoOpenIfEmpty && totalChannelSlots > 0) {
      const refreshed = queryClient.getQueryData<SettingsPageState>(settingsPageQueryKey)
      if ((refreshed?.connectedChannels ?? []).length === 0) {
        setChannelsModalOpen(true)
      }
    }
  }

  async function onCreateProject(input: { name: string }) {
    await createProjectFn({ data: input })
    // New project becomes active and starts at zero channels, so always
    // auto-open the modal to walk the operator straight into OAuth.
    await refreshAfterProjectChange({ autoOpenIfEmpty: true })
  }

  async function onSwitchProject(projectId: string) {
    await setActiveProjectFn({ data: { projectId } })
    await refreshAfterProjectChange({ autoOpenIfEmpty: true })
  }

  return (
    <AppLayout
      operatorName={operatorName}
      projectSwitcher={
        pageState.projects.length > 0 ? (
          <ProjectSwitcher
            activeProjectId={pageState.activeProjectId}
            onSwitch={onSwitchProject}
            projects={pageState.projects}
            totalChannelSlots={totalChannelSlots}
          />
        ) : null
      }
    >
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
        <StatusCard configured={settings.modelConfigured} enabled icon={Bot} label="AI model" />
        <StatusCard
          configured={settings.xConfigured}
          enabled={pageState.instanceOAuthProviders.x}
          icon={Send}
          label="X publishing"
        />
        <StatusCard
          configured={settings.linkedinConfigured}
          enabled={pageState.instanceOAuthProviders.linkedin}
          icon={Link2}
          label="LinkedIn"
        />
      </section>

      <div className="settings-page-grid">
        <AiWorkspace
          codexCli={pageState.codexCli}
          onSaved={(nextSettings) => void onSettingsChanged(nextSettings)}
          settings={settings}
        />

        <DevelopersSection isInstanceOwner={pageState.isInstanceOwner} />

        <ProjectsSection
          activeProjectId={pageState.activeProjectId}
          instanceOAuthProviders={pageState.instanceOAuthProviders}
          onCreate={onCreateProject}
          onSwitch={onSwitchProject}
          projects={pageState.projects}
        />

        <ChannelsSection
          activeProjectId={pageState.activeProjectId}
          connectedChannels={pageState.connectedChannels}
          instanceOAuthProviders={pageState.instanceOAuthProviders}
        />
      </div>

      <AppearanceSettings />

      <ConnectChannelsModal
        connectedChannels={pageState.connectedChannels}
        instanceOAuthProviders={pageState.instanceOAuthProviders}
        onClose={() => setChannelsModalOpen(false)}
        onContinue={() => setChannelsModalOpen(false)}
        open={channelsModalOpen}
      />
    </AppLayout>
  )
}

function StatusCard({
  configured,
  enabled,
  icon: Icon,
  label,
}: Readonly<{
  configured: boolean
  enabled: boolean
  icon: typeof Bot
  label: string
}>) {
  const isReady = enabled && configured
  const statusLabel = !enabled
    ? 'Not enabled'
    : configured
      ? 'Configured'
      : 'Missing'

  return (
    <article className="stat-card">
      <div className={isReady ? 'stat-icon ready' : 'stat-icon'}>
        <Icon aria-hidden="true" size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{statusLabel}</strong>
      </div>
      {isReady ? <CheckCircle2 aria-hidden="true" className="status-check" size={19} /> : null}
    </article>
  )
}
