import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { SetupKeyGate } from '../features/setup/setup-key-gate'
import { instanceSetupQueryOptions } from '../features/setup/setup-query'
import { SetupWizard } from '../features/setup/setup-wizard'

const searchSchema = z.object({
  setup_key: z.string().trim().optional(),
})

export const Route = createFileRoute('/setup')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ setupKey: search.setup_key }),
  loader: async ({ context, deps }) => {
    const status = await context.queryClient.ensureQueryData(
      instanceSetupQueryOptions(deps.setupKey),
    )
    if (status.configured) {
      throw redirect({ to: '/' })
    }
    return { status, setupKey: deps.setupKey }
  },
  component: SetupRoute,
})

function SetupRoute() {
  const { status, setupKey } = Route.useLoaderData()
  if (status.setupKey.required && !status.setupKey.valid) {
    return <SetupKeyGate status={status} />
  }
  return <SetupWizard initialStatus={status} setupKey={setupKey} />
}
