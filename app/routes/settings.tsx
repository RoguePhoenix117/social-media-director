import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../features/settings/settings-page'
import { settingsPageQueryOptions } from '../features/settings/settings-query'

export const Route = createFileRoute('/settings')({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsPageQueryOptions()),
  component: SettingsRouteComponent,
})

function SettingsRouteComponent() {
  const initialState = Route.useLoaderData()
  return <SettingsPage initialState={initialState} />
}
