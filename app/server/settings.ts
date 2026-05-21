import { createServerFn } from '@tanstack/react-start'
import { getCodexCliStatus } from '../lib/server/codex-cli'
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
 */

export const getSettingsPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const connectedChannels: PublicProjectChannel[] = session.activeProjectId
    ? await listPublicProjectChannels(session.activeProjectId)
    : []

  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    isInstanceOwner: session.isInstanceOwner,
    activeProjectId: session.activeProjectId,
    connectedChannels,
    settings: await getPublicSettingsStatus({ projectId: session.activeProjectId }),
    codexCli: await getCodexCliStatus(),
  }
})
