import { createServerFn } from '@tanstack/react-start'
import { getCodexCliStatus } from '../lib/server/codex-cli'
import { listOperatorProjects } from '../lib/server/projects'
import { listPublicProjectChannels, type PublicProjectChannel } from '../lib/server/provider-accounts'
import { requireOperatorSession } from '../lib/server/session'
import { getPublicSettingsStatus } from '../lib/server/settings'

/**
 * Server entry points for the Settings page.
 *
 * PR4 hard-cutover removed the legacy social token paste form, so this file
 * is now a thin read-only state aggregator. New mutations live in their own
 * domain server files (`app/server/projects.ts`, `app/server/channels.ts`,
 * `app/server/setup.ts`).
 *
 * PR6 added `projects` to the payload so Settings → Projects can list and
 * switch projects without an additional round trip.
 */

export const getSettingsPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const [projects, connectedChannels] = await Promise.all([
    listOperatorProjects(session.operatorId),
    session.activeProjectId
      ? listPublicProjectChannels(session.activeProjectId)
      : Promise.resolve<PublicProjectChannel[]>([]),
  ])

  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    isInstanceOwner: session.isInstanceOwner,
    activeProjectId: session.activeProjectId,
    projects,
    connectedChannels,
    settings: await getPublicSettingsStatus({ projectId: session.activeProjectId }),
    codexCli: await getCodexCliStatus(),
  }
})
