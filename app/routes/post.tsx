import { createFileRoute } from '@tanstack/react-router'
import { PostCalendarPage } from '../features/post-calendar/post-calendar-page'
import { postCalendarQueryOptions } from '../features/post-calendar/post-calendar-query'
import { ensureAuthenticatedRoute } from '../lib/route-auth'

export const Route = createFileRoute('/post')({
  loader: async ({ context, location }) => {
    await ensureAuthenticatedRoute(
      context.queryClient,
      location.pathname + location.searchStr,
    )
    return context.queryClient.ensureQueryData(postCalendarQueryOptions())
  },
  component: PostRouteComponent,
})

function PostRouteComponent() {
  const initialState = Route.useLoaderData()
  return <PostCalendarPage initialState={initialState} />
}
