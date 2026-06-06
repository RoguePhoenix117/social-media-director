import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { AppLayout } from '../../components/app-layout'
import { ProjectSwitcher } from '../../components/project-switcher'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import { setActiveProject } from '../../server/projects'
import type { getStatsPageState } from '../../server/stats'
import { getStatsPageState as getStatsPageStateFn } from '../../server/stats'

export function InternalStatsPage({
  initialState,
}: Readonly<{ initialState: Awaited<ReturnType<typeof getStatsPageState>> }>) {
  const setActiveProjectServerFn = useServerFn(setActiveProject)
  const getStatsFn = useServerFn(getStatsPageStateFn)

  const { data: state, refetch } = useQuery({
    queryKey: ['stats-page'],
    queryFn: () => getStatsFn(),
    initialData: initialState,
  })

  const displayName = state.operatorFirstName ?? state.operatorEmail ?? 'Signed in'
  const totalChannelSlots = countEnabledChannelSlots(state.instanceOAuthProviders)

  async function onSwitchProject(projectId: string) {
    await setActiveProjectServerFn({ data: { projectId } })
    await refetch()
  }

  const stats = state.stats

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
          <p className="eyebrow">Metrics</p>
          <h1>Stats</h1>
          <p className="page-summary">
            Internal counts from your workspace. Provider analytics (impressions, engagement) coming
            later.
          </p>
        </div>
      </header>

      {!state.activeProjectId || !stats ? (
        <p className="empty">Select a project to view stats.</p>
      ) : (
        <section className="stats-metrics-grid">
          <article className="stat-card">
            <p>Drafts (7 days)</p>
            <strong>{stats.draftsLast7Days}</strong>
          </article>
          <article className="stat-card">
            <p>Drafts (30 days)</p>
            <strong>{stats.draftsLast30Days}</strong>
          </article>
          <article className="stat-card">
            <p>Published on X</p>
            <strong>{stats.publishedByProvider.x}</strong>
          </article>
          <article className="stat-card">
            <p>Published on LinkedIn</p>
            <strong>{stats.publishedByProvider.linkedin}</strong>
          </article>
          <article className="stat-card">
            <p>Scheduled posts</p>
            <strong>{stats.scheduledTotal}</strong>
          </article>
          <article className="stat-card">
            <p>Failed schedules</p>
            <strong>{stats.scheduledFailed}</strong>
          </article>
        </section>
      )}

      <section className="overview-panel coming-soon-panel">
        <h2>Provider analytics</h2>
        <p className="setup-copy">
          Impressions, likes, and clicks from X and LinkedIn APIs will be added in a future phase.
        </p>
      </section>
    </AppLayout>
  )
}
