import { createFileRoute } from '@tanstack/react-router'
import { InternalStatsPage } from '../features/stats/internal-stats-page'
import { ensureAuthenticatedRoute } from '../lib/route-auth'
import { getStatsPageState } from '../server/stats'

export const Route = createFileRoute('/stats')({
  loader: async ({ context, location }) => {
    await ensureAuthenticatedRoute(
      context.queryClient,
      location.pathname + location.searchStr,
    )
    const state = await context.queryClient.ensureQueryData({
      queryKey: ['stats-page'],
      queryFn: () => getStatsPageState(),
    })
    return state
  },
  component: StatsRouteComponent,
})

function StatsRouteComponent() {
  const initialState = Route.useLoaderData()
  return <InternalStatsPage initialState={initialState} />
}
