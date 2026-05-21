import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { bootstrapQueryOptions } from '../lib/bootstrap-query'
import { isDatabaseConnectionError } from '../lib/db/errors'
import { DashboardScreen } from '../features/dashboard/dashboard-screen'
import { DatabaseSetupScreen } from '../features/dashboard/database-setup-screen'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const bootstrap = await context.queryClient.ensureQueryData(bootstrapQueryOptions())
    if (bootstrap.databaseAvailable && !bootstrap.instanceConfigured) {
      throw redirect({ to: '/setup' })
    }
    return bootstrap
  },
  component: DashboardRoute,
  errorComponent: DashboardError,
})

function DashboardRoute() {
  const bootstrap = Route.useLoaderData()
  return <DashboardScreen bootstrap={bootstrap} />
}

function DashboardError({ error }: ErrorComponentProps) {
  const router = useRouter()
  if (isDatabaseConnectionError(error)) {
    return <DatabaseSetupScreen onRetry={() => void router.invalidate()} />
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Dashboard error</p>
        <h1>Dashboard could not load</h1>
        <p className="setup-copy">{error.message}</p>
        <button onClick={() => void router.invalidate()} type="button">
          Retry
        </button>
      </section>
    </main>
  )
}
