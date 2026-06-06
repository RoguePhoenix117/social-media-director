import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listMonitorActivity } from '../lib/db/repository'
import { listOperatorProjects } from '../lib/server/projects'
import { getInstanceOAuthProviders } from '../lib/server/instance-config'
import { requireOperatorSession } from '../lib/server/session'

const monitorFilterSchema = z.enum(['all', 'published', 'failed', 'upcoming'])

const monitorInputSchema = z.object({
  filter: monitorFilterSchema.default('all'),
})

export const getMonitorPageState = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => monitorInputSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projects = await listOperatorProjects(session.operatorId)
    const filter = data.filter
    const activeProjectId = session.activeProjectId

    const activity =
      activeProjectId ? await listMonitorActivity(activeProjectId, filter) : []

    return {
      operatorEmail: session.email,
      operatorFirstName: session.firstName,
      activeProjectId,
      projects,
      instanceOAuthProviders: await getInstanceOAuthProviders(),
      filter,
      activity,
    }
  })
