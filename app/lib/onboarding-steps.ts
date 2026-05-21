/**
 * Canonical onboarding step constants used by both client (wizard navigation)
 * and server (advancing `operators.onboarding_step_completed`). PR4 will
 * gradually replace remaining magic numbers in `app/routes/index.tsx`.
 *
 * Order (numeric) matches `operators.onboarding_step_completed` values.
 */

export const ONBOARDING_STEPS = {
  account: 1,
  createProject: 2,
  connectChannels: 3,
  aiSetup: 4,
  complete: 5,
} as const

export type OnboardingStepId = keyof typeof ONBOARDING_STEPS
export type OnboardingStepNumber = (typeof ONBOARDING_STEPS)[OnboardingStepId]

export const ONBOARDING_STEP_LIST: ReadonlyArray<{
  id: OnboardingStepId
  step: OnboardingStepNumber
  label: string
}> = [
  { id: 'account', step: ONBOARDING_STEPS.account, label: 'Account' },
  { id: 'createProject', step: ONBOARDING_STEPS.createProject, label: 'Create project' },
  { id: 'connectChannels', step: ONBOARDING_STEPS.connectChannels, label: 'Connect channels' },
  { id: 'aiSetup', step: ONBOARDING_STEPS.aiSetup, label: 'AI setup' },
  { id: 'complete', step: ONBOARDING_STEPS.complete, label: 'Complete' },
]

export function isOnboardingComplete(stepCompleted: number): boolean {
  return stepCompleted >= ONBOARDING_STEPS.complete
}

export function onboardingStepFromNumber(value: number): OnboardingStepId | null {
  const match = ONBOARDING_STEP_LIST.find((entry) => entry.step === value)
  return match?.id ?? null
}
