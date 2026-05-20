import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { DesignProvider, parseDesignPreferences } from '../components/design-context'
import '../styles.css'

type RouterContext = {
  queryClient: QueryClient
}

const getInitialDesignPreferences = createServerFn({ method: 'GET' }).handler(() =>
  parseDesignPreferences(getRequestHeader('cookie')),
)

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: () => getInitialDesignPreferences(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Social Media Director' },
    ],
  }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const initialDesignPreferences = Route.useLoaderData()

  return (
    <RootDocument initialDesignPreferences={initialDesignPreferences} queryClient={queryClient}>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({
  children,
  initialDesignPreferences,
  queryClient,
}: Readonly<{
  children: ReactNode
  initialDesignPreferences: Awaited<ReturnType<typeof getInitialDesignPreferences>>
  queryClient: QueryClient
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <QueryClientProvider client={queryClient}>
          <DesignProvider initialPreferences={initialDesignPreferences}>{children}</DesignProvider>
        </QueryClientProvider>
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'TanStack Query',
              render: <ReactQueryDevtoolsPanel client={queryClient} />,
            },
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  const { queryClient } = Route.useRouteContext()
  const initialDesignPreferences = Route.useLoaderData()

  return (
    <RootDocument initialDesignPreferences={initialDesignPreferences} queryClient={queryClient}>
      <RouteFallback
        action={<RetryButton />}
        title="Something went wrong"
        message={error.message}
      />
    </RootDocument>
  )
}

function RootNotFoundComponent() {
  return (
    <RouteFallback
      action={
        <Link className="button-link" to="/">
          Go home
        </Link>
      }
      title="Page not found"
      message="That route does not exist in Social Media Director."
    />
  )
}

function RetryButton() {
  const router = useRouter()

  return (
    <button onClick={() => void router.invalidate()} type="button">
      Retry
    </button>
  )
}

function RouteFallback({
  action,
  message,
  title,
}: Readonly<{
  action: ReactNode
  message: string
  title: string
}>) {
  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Social Media Director</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {action}
      </section>
    </main>
  )
}
