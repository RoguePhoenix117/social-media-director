import { createServerFn } from '@tanstack/react-start'
import {
  calendarRangeInputSchema,
  cancelScheduledPostInputSchema,
  scheduleDraftInputSchema,
} from '../lib/post-calendar-schemas'
import {
  createScheduledPost,
  cancelScheduledPost,
  listReadyDrafts,
  listScheduledPosts,
} from '../lib/db/repository'
import { listOperatorProjects, requireActiveProjectId } from '../lib/server/projects'
import { listPublicProjectChannels } from '../lib/server/provider-accounts'
import { getInstanceOAuthProviders } from '../lib/server/instance-config'
import { requireOperatorSession } from '../lib/server/session'
import { getPublicSettingsStatus } from '../lib/server/settings'
export const getPostCalendarPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const projects = await listOperatorProjects(session.operatorId)
  const activeProjectId = session.activeProjectId
  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [readyDrafts, scheduledPosts, connectedChannels, instanceOAuthProviders] =
    await Promise.all([
      activeProjectId ? listReadyDrafts(activeProjectId) : Promise.resolve([]),
      activeProjectId
        ? listScheduledPosts(activeProjectId, { start: rangeStart, end: rangeEnd })
        : Promise.resolve([]),
      activeProjectId
        ? listPublicProjectChannels(activeProjectId)
        : Promise.resolve([]),
      getInstanceOAuthProviders(),
    ])

  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    activeProjectId,
    projects,
    connectedChannels,
    instanceOAuthProviders,
    settings: await getPublicSettingsStatus({ projectId: activeProjectId }),
    readyDrafts,
    scheduledPosts,
    calendarRange: { start: rangeStart, end: rangeEnd },
  }
})

export const listCalendarScheduledPosts = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => calendarRangeInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    return listScheduledPosts(projectId, { start: data.start, end: data.end })
  })

export const scheduleDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => scheduleDraftInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)

    const scheduled = await createScheduledPost({
      projectId,
      masterPostId: data.masterPostId,
      scheduledAt: data.scheduledAt,
      timezone: data.timezone,
    })

    return { scheduled }
  })

export const cancelScheduledPostFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => cancelScheduledPostInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    const projectId = await requireActiveProjectId(session)
    await cancelScheduledPost(data.scheduledPostId, projectId)
    return { ok: true }
  })

export const listReadyDraftsForPost = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  const projectId = await requireActiveProjectId(session)
  return listReadyDrafts(projectId)
})
