import { ONBOARDING_STEPS } from '../../lib/onboarding-steps'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import type { WizardMode, WizardStepId } from './wizard-types'

const WIZARD_STEPS: ReadonlyArray<{ id: WizardStepId; step: number; label: string }> = [
  { id: 'account', step: ONBOARDING_STEPS.account, label: 'Account' },
  { id: 'createProject', step: ONBOARDING_STEPS.createProject, label: 'Project' },
  { id: 'connectChannels', step: ONBOARDING_STEPS.connectChannels, label: 'Channels' },
  { id: 'aiSetup', step: ONBOARDING_STEPS.aiSetup, label: 'AI' },
]

/**
 * Numbered step indicator used by {@link OnboardingWizard}. Lifted out to
 * keep the wizard file focused on flow control + step content.
 */
export function WizardStepper({
  current,
  mode,
  onboardingStepCompleted,
  onNavigate,
  settings,
  connectedChannels,
}: Readonly<{
  current: WizardStepId
  mode: WizardMode
  onboardingStepCompleted: number
  onNavigate: (target: WizardStepId) => void
  settings: PublicSettingsStatus | null
  connectedChannels: number
}>) {
  return (
    <div aria-label="Onboarding progress" className="stepper">
      {WIZARD_STEPS.map((entry) => {
        if (entry.id === 'account' && mode !== 'first-run') return null
        const reachable = canVisit(entry.id, mode, current, onboardingStepCompleted)
        const indicatorClass = stepClass(
          entry,
          current,
          settings,
          onboardingStepCompleted,
          connectedChannels,
        )

        return (
          <button
            aria-current={current === entry.id ? 'step' : undefined}
            className={indicatorClass || undefined}
            disabled={!reachable}
            key={entry.id}
            onClick={() => {
              if (!reachable) return
              onNavigate(entry.id)
            }}
            type="button"
          >
            {entry.step} {entry.label}
          </button>
        )
      })}
    </div>
  )
}

function stepClass(
  entry: (typeof WIZARD_STEPS)[number],
  current: WizardStepId,
  settings: PublicSettingsStatus | null,
  onboardingStepCompleted: number,
  connectedChannels: number,
) {
  if (current === entry.id) return 'active'
  if (isStepConfigured(entry.id, settings, onboardingStepCompleted, connectedChannels)) return 'done'
  if (onboardingStepCompleted >= entry.step) return 'skipped'
  return ''
}

function isStepConfigured(
  id: WizardStepId,
  settings: PublicSettingsStatus | null,
  stepCompleted: number,
  connectedChannels: number,
) {
  switch (id) {
    case 'account':
      return stepCompleted >= ONBOARDING_STEPS.account
    case 'createProject':
      return stepCompleted >= ONBOARDING_STEPS.createProject
    case 'connectChannels':
      return connectedChannels > 0
    case 'aiSetup':
      return Boolean(settings?.modelConfigured)
  }
}

function canVisit(
  target: WizardStepId,
  mode: WizardMode,
  current: WizardStepId,
  stepCompleted: number,
) {
  const targetEntry = WIZARD_STEPS.find((entry) => entry.id === target)
  const currentEntry = WIZARD_STEPS.find((entry) => entry.id === current)
  if (!targetEntry || !currentEntry) return false
  if (mode === 'resume' && target === 'account') return false
  const furthest = Math.max(currentEntry.step, stepCompleted + 1)
  return targetEntry.step <= furthest && targetEntry.step <= ONBOARDING_STEPS.aiSetup
}
