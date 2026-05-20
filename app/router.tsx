import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { createAppQueryClient } from './lib/query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createAppQueryClient()

  return createTanStackRouter({
    context: {
      queryClient,
    },
    routeTree,
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
