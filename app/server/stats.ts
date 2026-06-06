import { createServerFn } from '@tanstack/react-start'
import { getInternalStats } from '../lib/db/repository'
import { listOperatorProjects } from '../lib/server/projects'
import { getInstanceOAuthProviders } from '../lib/server/instance-config'
import { requireOperatorSession } from '../lib/server/session'

export const getStatsPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const projects = await listOperatorProjects(session.operatorId)
  const activeProjectId = session.activeProjectId

  const stats = activeProjectId ? await getInternalStats(activeProjectId) : null

  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    activeProjectId,
    projects,
    instanceOAuthProviders: await getInstanceOAuthProviders(),
    stats,
  }
})
