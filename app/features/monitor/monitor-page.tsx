import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AppLayout } from '../../components/app-layout'
import { ProjectSwitcher } from '../../components/project-switcher'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import { setActiveProject } from '../../server/projects'
import type { getMonitorPageState } from '../../server/monitor'
import { getMonitorPageState as getMonitorPageStateFn } from '../../server/monitor'

type MonitorFilter = 'all' | 'published' | 'failed' | 'upcoming'

export function MonitorPage({
  initialState,
}: Readonly<{ initialState: Awaited<ReturnType<typeof getMonitorPageState>> }>) {
  const setActiveProjectServerFn = useServerFn(setActiveProject)
  const getMonitorFn = useServerFn(getMonitorPageStateFn)
  const [filter, setFilter] = useState<MonitorFilter>(initialState.filter)

  const { data: state, refetch } = useQuery({
    queryKey: ['monitor-page', filter],
    queryFn: () => getMonitorFn({ data: { filter } }),
    initialData: initialState,
  })

  const displayName = state.operatorFirstName ?? state.operatorEmail ?? 'Signed in'
  const totalChannelSlots = countEnabledChannelSlots(state.instanceOAuthProviders)

  async function onSwitchProject(projectId: string) {
    await setActiveProjectServerFn({ data: { projectId } })
    await refetch()
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
          <p className="eyebrow">Activity</p>
          <h1>Monitor</h1>
          <p className="page-summary">
            Publish and schedule activity for the active project. Social inbox coming later.
          </p>
        </div>
      </header>

      <div className="draft-status-tabs" role="tablist">
        {(['all', 'published', 'failed', 'upcoming'] as MonitorFilter[]).map((tab) => (
          <button
            aria-selected={filter === tab}
            className={filter === tab ? 'active' : undefined}
            key={tab}
            onClick={() => setFilter(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {!state.activeProjectId ? (
        <p className="empty">Select a project to view activity.</p>
      ) : state.activity.length === 0 ? (
        <p className="empty">No activity for this filter yet.</p>
      ) : (
        <ul className="monitor-activity-list">
          {state.activity.map((item) => (
            <li key={item.id}>
              <div>
                <p className="eyebrow">
                  {item.type} · {item.status}
                </p>
                <strong>{item.title}</strong>
                {item.detail ? <span>{item.detail}</span> : null}
              </div>
              <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}

      <section className="overview-panel coming-soon-panel">
        <h2>Social inbox</h2>
        <p className="setup-copy">
          Mentions, replies, and DMs from connected channels will appear here in a future release.
        </p>
      </section>
    </AppLayout>
  )
}
