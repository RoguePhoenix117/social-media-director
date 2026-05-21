import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '../lib/db/client'
import { ONBOARDING_STEPS } from '../lib/onboarding-steps'
import {
  createProject as createProjectRecord,
  ensureOperatorProjectAccess,
  listOperatorProjects,
  setActiveProject as setActiveProjectInSession,
  type OperatorProject,
} from '../lib/server/projects'
import {
  listPublicProjectChannels,
  type PublicProjectChannel,
} from '../lib/server/provider-accounts'
import { requireOperatorSession } from '../lib/server/session'
import { getPublicSettingsStatus, type PublicSettingsStatus } from '../lib/server/settings'

/**
 * Onboarding-aware server entry points for project lifecycle. These wrap the
 * lib-level helpers in {@link ../lib/server/projects} and additionally
 * advance the operator's onboarding step counter so the wizard reactively
 * progresses on the client.
 *
 * Replaces the legacy `saveXStep` / `saveLinkedInStep` flow from PR1–PR3:
 * channels are connected via OAuth (`/integrations/social/{provider}`),
 * never by pasting tokens. See plan.md "PR4".
 */

const createProjectStepInputSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(80),
})

export type OnboardingStepResult = {
  onboardingStepCompleted: number
  onboardingDismissed: boolean
  activeProjectId: string | null
  projects: OperatorProject[]
  connectedChannels: PublicProjectChannel[]
  settings: PublicSettingsStatus
}

export const createProjectStep = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createProjectStepInputSchema.parse(input))
  .handler(async ({ data }): Promise<OnboardingStepResult> => {
    const session = await requireOperatorSession()

    const project = await createProjectRecord({
      operatorId: session.operatorId,
      name: data.name,
    })

    await setActiveProjectInSession({
      sessionId: session.sessionId,
      operatorId: session.operatorId,
      projectId: project.id,
    })

    await advanceOnboardingStep(session.operatorId, ONBOARDING_STEPS.createProject)

    return buildOnboardingStepResult({
      operatorId: session.operatorId,
      activeProjectId: project.id,
    })
  })

export const completeChannelsStep = createServerFn({ method: 'POST' }).handler(
  async (): Promise<OnboardingStepResult> => {
    const session = await requireOperatorSession()
    if (!session.activeProjectId) {
      throw new Error('Create a project before completing channel setup.')
    }

    await ensureOperatorProjectAccess(session.operatorId, session.activeProjectId)

    await getDb().query(
      `update projects
       set channels_onboarding_completed = true,
           updated_at = now()
       where id = $1`,
      [session.activeProjectId],
    )

    await advanceOnboardingStep(session.operatorId, ONBOARDING_STEPS.connectChannels)

    return buildOnboardingStepResult({
      operatorId: session.operatorId,
      activeProjectId: session.activeProjectId,
    })
  },
)

export const completeOnboarding = createServerFn({ method: 'POST' }).handler(
  async (): Promise<OnboardingStepResult> => {
    const session = await requireOperatorSession()
    await getDb().query(
      `update operators
       set onboarding_step_completed = greatest(onboarding_step_completed, $2),
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
       where id = $1`,
      [session.operatorId, ONBOARDING_STEPS.complete],
    )

    return buildOnboardingStepResult({
      operatorId: session.operatorId,
      activeProjectId: session.activeProjectId,
    })
  },
)

async function advanceOnboardingStep(operatorId: string, step: number) {
  await getDb().query(
    `update operators
     set onboarding_step_completed = greatest(onboarding_step_completed, $2)
     where id = $1`,
    [operatorId, step],
  )
}

async function buildOnboardingStepResult({
  operatorId,
  activeProjectId,
}: {
  operatorId: string
  activeProjectId: string | null
}): Promise<OnboardingStepResult> {
  const [projects, connectedChannels, settings, operatorStatus] = await Promise.all([
    listOperatorProjects(operatorId),
    activeProjectId ? listPublicProjectChannels(activeProjectId) : Promise.resolve([]),
    getPublicSettingsStatus({ checkCodexAuth: false, projectId: activeProjectId }),
    readOperatorOnboardingStatus(operatorId),
  ])

  return {
    onboardingStepCompleted: operatorStatus.onboardingStepCompleted,
    onboardingDismissed: operatorStatus.onboardingDismissed,
    activeProjectId,
    projects,
    connectedChannels,
    settings,
  }
}

async function readOperatorOnboardingStatus(operatorId: string): Promise<{
  onboardingStepCompleted: number
  onboardingDismissed: boolean
}> {
  const result = await getDb().query<{
    onboarding_step_completed: number
    onboarding_dismissed: boolean
  }>(
    `select
       onboarding_step_completed,
       (onboarding_dismissed_at is not null) as onboarding_dismissed
     from operators
     where id = $1`,
    [operatorId],
  )
  const row = result.rows[0]
  return {
    onboardingStepCompleted: row?.onboarding_step_completed ?? 0,
    onboardingDismissed: row?.onboarding_dismissed ?? false,
  }
}
