import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCodexCliStatus } from '../lib/server/codex-cli'
import { requireOperatorSession } from '../lib/server/session'
import { getPublicSettingsStatus, saveAppSettings } from '../lib/server/settings'

/**
 * Server entry points for the settings page. The legacy token-paste mutation
 * lives here too so the route file can stay compositional; it disappears in
 * PR4 when manual token paste is removed entirely (see plan.md).
 */

/** @deprecated Removed in PR4 with the token paste UI. */
const legacySocialSettingsSchema = z.object({
  xAccessToken: z.string().optional(),
  xRefreshToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})

export const getSettingsPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    isInstanceOwner: session.isInstanceOwner,
    settings: await getPublicSettingsStatus(),
    codexCli: await getCodexCliStatus(),
  }
})

/** @deprecated Removed in PR4 with the token paste UI. */
export const saveLegacySocialSettings = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => legacySocialSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    await saveAppSettings(data)
    return getPublicSettingsStatus()
  })
