import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DraftPage } from '../features/draft/draft-page'
import { draftPageQueryOptions } from '../features/draft/draft-query'
import { ensureAuthenticatedRoute } from '../lib/route-auth'

const draftSearchSchema = z.object({
  id: z.string().uuid().optional(),
})

export const Route = createFileRoute('/draft')({
  validateSearch: draftSearchSchema,
  loader: async ({ context, location }) => {
    await ensureAuthenticatedRoute(
      context.queryClient,
      location.pathname + location.searchStr,
    )
    return context.queryClient.ensureQueryData(draftPageQueryOptions())
  },
  component: DraftRouteComponent,
})

function DraftRouteComponent() {
  const initialState = Route.useLoaderData()
  const search = Route.useSearch()
  return <DraftPage initialState={initialState} search={search} />
}
