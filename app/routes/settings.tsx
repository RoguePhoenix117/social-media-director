import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../features/settings/settings-page'
import { settingsPageQueryOptions } from '../features/settings/settings-query'
import { ensureAuthenticatedRoute } from '../lib/route-auth'

export const Route = createFileRoute('/settings')({
  loader: async ({ context, location }) => {
    await ensureAuthenticatedRoute(
      context.queryClient,
      location.pathname + location.searchStr,
    )
    return context.queryClient.ensureQueryData(settingsPageQueryOptions())
  },
  component: SettingsRouteComponent,
})

function SettingsRouteComponent() {
  const initialState = Route.useLoaderData()
  return <SettingsPage initialState={initialState} />
}
