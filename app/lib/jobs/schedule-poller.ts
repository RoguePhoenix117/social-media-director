import {
  listDueScheduledPosts,
  updateScheduledPostStatus,
} from '../db/repository'
import { logError, logInfo } from '../server/logger'
import { publishMasterPostForSchedule } from '../server/publish-service'

let pollerTimer: ReturnType<typeof setInterval> | null = null

export function startSchedulePoller(intervalMs = 60_000) {
  if (pollerTimer) return

  pollerTimer = setInterval(() => {
    void runSchedulePollerTick()
  }, intervalMs)

  void runSchedulePollerTick()
}

export function stopSchedulePoller() {
  if (pollerTimer) {
    clearInterval(pollerTimer)
    pollerTimer = null
  }
}

export async function runSchedulePollerTick() {
  const due = await listDueScheduledPosts()
  if (!due.length) return

  for (const item of due) {
    try {
      await updateScheduledPostStatus(item.id, 'publishing')
      await publishMasterPostForSchedule(item.masterPostId, item.projectId)
      await updateScheduledPostStatus(item.id, 'published')
      logInfo('schedule_poller.published', {
        scheduledPostId: item.id,
        masterPostId: item.masterPostId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled publish failed.'
      await updateScheduledPostStatus(item.id, 'failed', message)
      logError('schedule_poller.failed', error, { scheduledPostId: item.id })
    }
  }
}
