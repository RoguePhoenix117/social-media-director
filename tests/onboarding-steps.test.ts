import { describe, expect, it } from 'vitest'
import { ONBOARDING_STEPS, resolveWizardStep } from '../app/lib/onboarding-steps'

describe('resolveWizardStep', () => {
  it('skips project creation when the operator already has a project', () => {
    expect(
      resolveWizardStep({
        mode: 'resume',
        onboardingStepCompleted: ONBOARDING_STEPS.account,
        projectCount: 1,
        modelConfigured: false,
      }),
    ).toBe('connectChannels')
  })

  it('shows project creation when no project exists yet', () => {
    expect(
      resolveWizardStep({
        mode: 'resume',
        onboardingStepCompleted: ONBOARDING_STEPS.account,
        projectCount: 0,
        modelConfigured: false,
      }),
    ).toBe('createProject')
  })
})
