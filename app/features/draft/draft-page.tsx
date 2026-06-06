import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ActiveAiBackendControl } from '../../components/active-ai-backend-control'
import { AiWorkspace } from '../../components/ai-workspace'
import { AppLayout } from '../../components/app-layout'
import { ProjectSwitcher } from '../../components/project-switcher'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import type { MasterPostStatus } from '../../lib/db/draft-types'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import { setActiveProject } from '../../server/projects'
import type { getDraftPageState } from '../../server/drafts'
import { draftPageQueryKey, draftPageQueryOptions } from './draft-query'
import { DraftList } from './draft-list'
import { DraftWorkspace } from './draft-workspace'

type DraftPageState = Awaited<ReturnType<typeof getDraftPageState>>

type DraftSearch = {
  id?: string
}

export function DraftPage({
  initialState,
  search,
}: Readonly<{
  initialState: DraftPageState
  search: DraftSearch
}>) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setActiveProjectFn = useServerFn(setActiveProject)
  const { data: state } = useQuery({
    ...draftPageQueryOptions(),
    initialData: initialState,
  })

  const [activeTab, setActiveTab] = useState<MasterPostStatus | 'all'>('all')
  const masterPostId = search.id ?? null
  const displayName = state.operatorFirstName ?? state.operatorEmail ?? 'Signed in'
  const totalChannelSlots = countEnabledChannelSlots(state.instanceOAuthProviders)

  const connectedChannels = state.connectedChannels

  async function refreshDrafts() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: draftPageQueryKey, refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey, refetchType: 'all' }),
    ])
  }

  async function onSwitchProject(projectId: string) {
    await setActiveProjectFn({ data: { projectId } })
    await refreshDrafts()
    if (masterPostId) {
      void navigate({ to: '/draft', search: {} })
    }
  }

  function onSettingsChanged(nextSettings: PublicSettingsStatus) {
    queryClient.setQueryData(draftPageQueryKey, { ...state, settings: nextSettings })
  }

  return (
    <AppLayout
      operatorName={displayName}
      projectSwitcher={
        state.projects.length > 0 ? (
          <ProjectSwitcher
            activeProjectId={state.activeProjectId}
            onSwitch={onSwitchProject}
            projects={state.projects}
            totalChannelSlots={totalChannelSlots}
          />
        ) : null
      }
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Drafts</h1>
          <p className="page-summary">
            Import blog posts, shape platform-specific copy, and mark drafts ready for
            publishing on the Post calendar.
          </p>
        </div>
      </header>

      {!state.activeProjectId ? (
        <section className="auth-panel">
          <p className="setup-copy">
            Create a project on the dashboard before managing drafts.
          </p>
          <Link className="button-link" to="/">
            Go to Dashboard
          </Link>
        </section>
      ) : (
        <>
          {state.settings ? (
            state.settings.configuredAiBackendTypes.length > 0 ? (
              <ActiveAiBackendControl
                onChange={onSettingsChanged}
                settings={state.settings}
              />
            ) : (
              <AiWorkspace
                codexCli={null}
                compactIntro
                onSaved={onSettingsChanged}
                settings={state.settings}
              />
            )
          ) : null}

          {masterPostId ? (
            <DraftWorkspace
              connectedChannels={connectedChannels}
              masterPostId={masterPostId}
              onDraftSaved={(id) => {
                refreshDrafts()
                void navigate({ to: '/draft', search: { id } })
              }}
              onMarkedReady={refreshDrafts}
              settings={state.settings}
            />
          ) : (
            <>
              <DraftList
                activeTab={activeTab}
                drafts={state.drafts}
                onTabChange={setActiveTab}
              />
              <section className="draft-new-section">
                <DraftWorkspace
                  connectedChannels={connectedChannels}
                  masterPostId={null}
                  onDraftSaved={(id) => {
                    refreshDrafts()
                    void navigate({ to: '/draft', search: { id } })
                  }}
                  onMarkedReady={refreshDrafts}
                  settings={state.settings}
                />
              </section>
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
