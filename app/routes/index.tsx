import { Navigate, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { z } from 'zod'
import { bootstrapQueryOptions } from '../lib/bootstrap-query'
import { isDatabaseConnectionError } from '../lib/db/errors'
import { isOperatorAuthError } from '../lib/auth-errors'
import { DashboardScreen } from '../features/dashboard/dashboard-screen'
import { DatabaseSetupScreen } from '../features/dashboard/database-setup-screen'

const indexSearchSchema = z.object({
  auth: z.enum(['login', 'signup']).optional(),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: indexSearchSchema,
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
  const search = Route.useSearch()
  return <DashboardScreen bootstrap={bootstrap} search={search} />
}

function DashboardError({ error }: ErrorComponentProps) {
  const router = useRouter()
  if (isDatabaseConnectionError(error)) {
    return <DatabaseSetupScreen onRetry={() => void router.invalidate()} />
  }

  if (isOperatorAuthError(error)) {
    return <Navigate replace search={{ auth: 'login' }} to="/" />
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
