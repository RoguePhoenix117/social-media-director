import { createFileRoute } from '@tanstack/react-router'
import { MonitorPage } from '../features/monitor/monitor-page'
import { ensureAuthenticatedRoute } from '../lib/route-auth'
import { getMonitorPageState } from '../server/monitor'

export const Route = createFileRoute('/monitor')({
  loader: async ({ context, location }) => {
    await ensureAuthenticatedRoute(
      context.queryClient,
      location.pathname + location.searchStr,
    )
    const state = await context.queryClient.ensureQueryData({
      queryKey: ['monitor-page', 'all'],
      queryFn: () => getMonitorPageState({ data: { filter: 'all' } }),
    })
    return state
  },
  component: MonitorRouteComponent,
})

function MonitorRouteComponent() {
  const initialState = Route.useLoaderData()
  return <MonitorPage initialState={initialState} />
}
