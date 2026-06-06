import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { bootstrapQueryOptions } from './bootstrap-query'

export type AuthRedirectSearch = {
  auth?: 'login' | 'signup'
  redirect?: string
}

/**
 * Ensures the operator is signed in before loading a protected route.
 * Redirects to `/` with auth tab + return path when not authenticated.
 */
export async function ensureAuthenticatedRoute(
  queryClient: QueryClient,
  returnPath?: string,
) {
  const bootstrap = await queryClient.ensureQueryData(bootstrapQueryOptions())

  if (!bootstrap.databaseAvailable) {
    return bootstrap
  }

  if (!bootstrap.instanceConfigured) {
    throw redirect({ to: '/setup' })
  }

  const redirectSearch: AuthRedirectSearch = returnPath ? { redirect: returnPath } : {}

  if (!bootstrap.hasOperator) {
    throw redirect({
      to: '/',
      search: { ...redirectSearch, auth: 'signup' },
    })
  }

  if (!bootstrap.isAuthenticated) {
    throw redirect({
      to: '/',
      search: { ...redirectSearch, auth: 'login' },
    })
  }

  return bootstrap
}
