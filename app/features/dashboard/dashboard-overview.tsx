import { Link } from '@tanstack/react-router'
import type { getBootstrapState } from '../../server/dashboard'

type OverviewData = Pick<
  Awaited<ReturnType<typeof getBootstrapState>>,
  'draftCounts' | 'recentPublishes' | 'upcomingScheduled'
>

export function DashboardOverview({ data }: Readonly<{ data: OverviewData }>) {
  return (
    <section className="dashboard-overview">
      <div className="overview-panel">
        <h2>Draft counts</h2>
        <ul className="overview-counts">
          <li>
            <span>Draft</span>
            <strong>{data.draftCounts.draft}</strong>
          </li>
          <li>
            <span>Ready</span>
            <strong>{data.draftCounts.ready}</strong>
          </li>
          <li>
            <span>Published</span>
            <strong>{data.draftCounts.published}</strong>
          </li>
        </ul>
        <Link className="text-link" to="/draft">
          Open drafts
        </Link>
      </div>

      <div className="overview-panel">
        <h2>Recent publishes</h2>
        {data.recentPublishes.length === 0 ? (
          <p className="empty">No publishes yet.</p>
        ) : (
          <ul className="overview-activity-list">
            {data.recentPublishes.map((item) => (
              <li key={item.id}>
                <strong>{item.draftSummary}</strong>
                <span>
                  {item.provider} — {item.status}
                  {item.providerPostUrl ? (
                    <>
                      {' '}
                      <a href={item.providerPostUrl} rel="noreferrer" target="_blank">
                        View
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link className="text-link" to="/monitor">
          View monitor
        </Link>
      </div>

      <div className="overview-panel">
        <h2>Upcoming scheduled</h2>
        {data.upcomingScheduled.length === 0 ? (
          <p className="empty">Nothing scheduled in the next 30 days.</p>
        ) : (
          <ul className="overview-activity-list">
            {data.upcomingScheduled.map((item) => (
              <li key={item.id}>
                <strong>{item.summary}</strong>
                <span>{new Date(item.scheduledAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        <Link className="text-link" to="/post">
          Open calendar
        </Link>
      </div>
    </section>
  )
}
