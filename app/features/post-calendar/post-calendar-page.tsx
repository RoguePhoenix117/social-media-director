import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Calendar, Clock, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppLayout } from '../../components/app-layout'
import { ProjectSwitcher } from '../../components/project-switcher'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import { countEnabledChannelSlots } from '../../lib/channel-catalog'
import type { DraftListItem } from '../../lib/db/draft-types'
import type { ScheduledPostItem } from '../../lib/db/draft-types'
import { setActiveProject } from '../../server/projects'
import { publishDraftNow } from '../../server/publish'
import type { getPostCalendarPageState } from '../../server/post-calendar'
import { cancelScheduledPostFn, scheduleDraft } from '../../server/post-calendar'
import { postCalendarQueryKey, postCalendarQueryOptions } from './post-calendar-query'

type PostCalendarState = Awaited<ReturnType<typeof getPostCalendarPageState>>

export function PostCalendarPage({
  initialState,
}: Readonly<{ initialState: PostCalendarState }>) {
  const queryClient = useQueryClient()
  const setActiveProjectFn = useServerFn(setActiveProject)
  const publishDraftNowFn = useServerFn(publishDraftNow)
  const scheduleDraftFn = useServerFn(scheduleDraft)
  const cancelScheduledFn = useServerFn(cancelScheduledPostFn)

  const { data: state } = useQuery({
    ...postCalendarQueryOptions(),
    initialData: initialState,
  })

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [scheduleAt, setScheduleAt] = useState('')
  const [statusMessage, setStatusMessage] = useState<string>()
  const [pending, setPending] = useState(false)

  const displayName = state.operatorFirstName ?? state.operatorEmail ?? 'Signed in'
  const totalChannelSlots = countEnabledChannelSlots(state.instanceOAuthProviders)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const calendarDays = useMemo(
    () => buildMonthGrid(new Date(state.calendarRange.start)),
    [state.calendarRange.start],
  )

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: postCalendarQueryKey, refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey, refetchType: 'all' }),
    ])
  }

  async function onSwitchProject(projectId: string) {
    await setActiveProjectFn({ data: { projectId } })
    await refresh()
  }

  const selectedDraft = state.readyDrafts.find((draft) => draft.id === selectedDraftId) ?? null

  async function onPublishNow(draft: DraftListItem) {
    setPending(true)
    setStatusMessage(undefined)
    try {
      await publishDraftNowFn({ data: { masterPostId: draft.id } })
      setStatusMessage(`Published "${draft.summary}" to connected channels.`)
      await refresh()
    } catch (caught) {
      setStatusMessage(caught instanceof Error ? caught.message : 'Publish failed.')
    } finally {
      setPending(false)
    }
  }

  async function onSchedule(draftId: string) {
    if (!scheduleAt) {
      setStatusMessage('Choose a date and time first.')
      return
    }
    setPending(true)
    try {
      await scheduleDraftFn({
        data: {
          masterPostId: draftId,
          scheduledAt: new Date(scheduleAt).toISOString(),
          timezone,
        },
      })
      setStatusMessage('Draft scheduled.')
      setSelectedSlot(null)
      setScheduleAt('')
      await refresh()
    } catch (caught) {
      setStatusMessage(caught instanceof Error ? caught.message : 'Schedule failed.')
    } finally {
      setPending(false)
    }
  }

  async function onCancelScheduled(item: ScheduledPostItem) {
    setPending(true)
    try {
      await cancelScheduledFn({ data: { scheduledPostId: item.id } })
      setStatusMessage('Scheduled post cancelled.')
      await refresh()
    } catch (caught) {
      setStatusMessage(caught instanceof Error ? caught.message : 'Cancel failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AppLayout
      operatorName={displayName}
      projectSwitcher={
        state.projects.length > 0 ? (
          <ProjectSwitcher
            activeProjectId={state.activeProjectId}
            onSwitch={onSwitchProject}
            projects={state.projects}
            totalChannelSlots={totalChannelSlots}
          />
        ) : null
      }
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">Publish</p>
          <h1>Post calendar</h1>
          <p className="page-summary">
            Publish ready drafts immediately or schedule them on the calendar.
          </p>
        </div>
        <Link className="button-link" to="/draft">
          Edit drafts
        </Link>
      </header>

      {!state.activeProjectId ? (
        <p className="empty">Create a project before scheduling posts.</p>
      ) : (
        <div className="post-calendar-layout">
          <section className="post-calendar-grid-panel">
            <h2>
              <Calendar aria-hidden="true" size={18} /> Calendar
            </h2>
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => {
                const dayPosts = state.scheduledPosts.filter((post) =>
                  post.scheduledAt.startsWith(day.isoDate),
                )
                return (
                  <button
                    className={`calendar-day ${day.inMonth ? '' : 'muted'} ${selectedSlot === day.isoDate ? 'selected' : ''}`}
                    key={day.key}
                    onClick={() => {
                      setSelectedSlot(day.isoDate)
                      if (!scheduleAt) {
                        setScheduleAt(`${day.isoDate}T09:00`)
                      }
                    }}
                    type="button"
                  >
                    <span className="calendar-day-number">{day.label}</span>
                    {dayPosts.map((post) => (
                      <span className="calendar-event" key={post.id} title={post.summary}>
                        {formatTime(post.scheduledAt)} {post.summary.slice(0, 24)}
                      </span>
                    ))}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="post-calendar-side-panel">
            <h2>Ready drafts</h2>
            {state.readyDrafts.length === 0 ? (
              <p className="empty">
                No ready drafts. Mark a draft ready on the{' '}
                <Link to="/draft">Draft</Link> page first.
              </p>
            ) : (
              <ul className="ready-draft-list">
                {state.readyDrafts.map((draft) => (
                  <li key={draft.id}>
                    <button
                      className={selectedDraftId === draft.id ? 'active' : undefined}
                      onClick={() => setSelectedDraftId(draft.id)}
                      type="button"
                    >
                      <strong>{draft.summary}</strong>
                      {draft.sourceTitle ? <span>{draft.sourceTitle}</span> : null}
                    </button>
                    <div className="ready-draft-actions">
                      <button
                        disabled={pending}
                        onClick={() => void onPublishNow(draft)}
                        type="button"
                      >
                        <Send aria-hidden="true" size={14} />
                        Publish now
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {(selectedDraft || selectedSlot) && (
              <div className="schedule-form">
                <h3>
                  <Clock aria-hidden="true" size={16} />
                  {selectedSlot ? `Schedule on ${selectedSlot}` : 'Schedule draft'}
                </h3>
                {selectedDraft ? (
                  <p className="setup-copy">Selected: {selectedDraft.summary}</p>
                ) : (
                  <p className="setup-copy">Pick a ready draft, then confirm date and time.</p>
                )}
                <label>
                  Date and time
                  <input
                    onChange={(event) => setScheduleAt(event.target.value)}
                    type="datetime-local"
                    value={scheduleAt}
                  />
                </label>
                <p className="generation-status">Timezone: {timezone}</p>
                <button
                  disabled={pending || !selectedDraft || !scheduleAt}
                  onClick={() => selectedDraft && void onSchedule(selectedDraft.id)}
                  type="button"
                >
                  Schedule draft
                </button>
              </div>
            )}

            <h3>Scheduled this month</h3>
            {state.scheduledPosts.length === 0 ? (
              <p className="empty">Nothing scheduled yet.</p>
            ) : (
              <ul className="scheduled-post-list">
                {state.scheduledPosts.map((post) => (
                  <li key={post.id}>
                    <div>
                      <strong>{post.summary}</strong>
                      <span>
                        {formatDateTime(post.scheduledAt)} ({post.timezone})
                      </span>
                      <span className={`status-pill ${post.status}`}>{post.status}</span>
                    </div>
                    {post.status === 'scheduled' ? (
                      <button
                        disabled={pending}
                        onClick={() => void onCancelScheduled(post)}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {statusMessage ? <p className="generation-status">{statusMessage}</p> : null}
          </section>
        </div>
      )}
    </AppLayout>
  )
}

function buildMonthGrid(reference: Date) {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const days: Array<{
    key: string
    label: number
    isoDate: string
    inMonth: boolean
  }> = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, index - startOffset + 1)
    const isoDate = date.toISOString().slice(0, 10)
    days.push({
      key: isoDate,
      label: date.getDate(),
      isoDate,
      inMonth: date.getMonth() === month,
    })
  }

  return days
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}
