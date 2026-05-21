import { X as XIcon } from 'lucide-react'
import { useState } from 'react'
import { ONBOARDING_STEPS } from '../../lib/onboarding-steps'
import type { CodexCliStatus } from '../../lib/server/codex-cli'
import type { PublicProjectChannel } from '../../lib/server/provider-accounts'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import { AiWorkspace } from '../ai-workspace'
import { ConnectChannelsModal } from '../connect-channels/connect-channels-modal'
import { CreateProjectScreen } from '../create-project-screen'
import { AccountStep, type AccountStepInput } from './account-step'
import { WizardStepper } from './wizard-stepper'
import type { WizardMode, WizardStepId } from './wizard-types'

/**
 * Composes the four-step onboarding flow:
 *  1. Account (first-run only)
 *  2. Create project (default-project)
 *  3. Connect Channels modal (auto-open, dismiss-allowed)
 *  4. AI setup (reuses {@link AiWorkspace})
 *
 * Each step delegates its mutation to a callback passed by the dashboard
 * route; the wizard owns local UI state (current step, errors) only.
 */
export function OnboardingWizard({
  mode,
  onboardingStepCompleted,
  settings,
  codexCli,
  connectedChannels,
  onAccountSave,
  onCreateProject,
  onCompleteChannels,
  onCompleteOnboarding,
  onDismiss,
}: Readonly<{
  mode: WizardMode
  onboardingStepCompleted: number
  settings: PublicSettingsStatus | null
  codexCli: CodexCliStatus | null
  connectedChannels: PublicProjectChannel[]
  onAccountSave?: (data: AccountStepInput) => Promise<void>
  onCreateProject: (input: { name: string }) => Promise<void>
  onCompleteChannels: () => Promise<void>
  onCompleteOnboarding: () => Promise<void>
  onDismiss?: () => Promise<void>
}>) {
  const initialStep = pickInitialStep(mode, onboardingStepCompleted, settings)
  const [step, setStep] = useState<WizardStepId>(initialStep)
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [channelsModalOpen, setChannelsModalOpen] = useState(initialStep === 'connectChannels')

  function clearStatus() {
    setError(undefined)
    setMessage(undefined)
  }

  function navigateTo(target: WizardStepId) {
    clearStatus()
    setStep(target)
    setChannelsModalOpen(target === 'connectChannels')
  }

  async function handleCreateProject(input: { name: string }) {
    clearStatus()
    try {
      await onCreateProject(input)
      setMessage(`Project "${input.name}" created. Connect channels next, or continue without them.`)
      navigateTo('connectChannels')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create project.')
      throw caught
    }
  }

  async function handleCompleteChannels() {
    clearStatus()
    try {
      await onCompleteChannels()
      setMessage(
        connectedChannels.length > 0
          ? 'Channels saved. Configure your AI backend next, or skip to finish.'
          : 'Continuing without channels. You can connect them later from the dashboard.',
      )
      navigateTo('aiSetup')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not advance from channels step.')
    }
  }

  async function handleAiSaved() {
    clearStatus()
    try {
      await onCompleteOnboarding()
      setMessage('AI backend saved. Welcome to your dashboard.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not finish onboarding.')
    }
  }

  async function handleSkipAi() {
    clearStatus()
    try {
      await onCompleteOnboarding()
      setMessage('Skipped AI setup. You can configure a backend anytime in Settings.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not finish onboarding.')
    }
  }

  async function handleDismiss() {
    if (!onDismiss) return
    clearStatus()
    try {
      await onDismiss()
      setMessage('Setup hidden from the dashboard. Open Settings anytime to finish.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not dismiss setup.')
    }
  }

  const shellClass = mode === 'first-run' ? 'auth-shell' : 'wizard-shell'
  const panelClass = mode === 'first-run' ? 'auth-panel onboarding-panel' : 'wizard-panel'

  return (
    <>
      <main className={shellClass}>
        <section className={panelClass}>
          <div className="wizard-panel-top">
            <div>
              <p className="eyebrow">{mode === 'first-run' ? 'First run' : 'Finish setup'}</p>
              <h1>
                {mode === 'first-run'
                  ? 'Set up Social Media Director'
                  : 'Continue onboarding'}
              </h1>
            </div>
            {mode === 'resume' && onDismiss ? (
              <button
                aria-label="Dismiss setup from dashboard"
                className="icon-button wizard-dismiss"
                onClick={() => void handleDismiss()}
                title="Hide setup wizard"
                type="button"
              >
                <XIcon aria-hidden="true" size={18} />
              </button>
            ) : null}
          </div>

          <WizardStepper
            connectedChannels={connectedChannels.length}
            current={step}
            mode={mode}
            onNavigate={navigateTo}
            onboardingStepCompleted={onboardingStepCompleted}
            settings={settings}
          />

          {step === 'account' && mode === 'first-run' && onAccountSave ? (
            <AccountStep onSave={onAccountSave} />
          ) : null}

          {step === 'createProject' ? (
            <CreateProjectScreen
              onSubmit={handleCreateProject}
              submitLabel="Create project and continue"
            />
          ) : null}

          {step === 'connectChannels' ? (
            <div className="onboarding-step-content">
              <div className="panel-heading">
                <div>
                  <h2>Connect Your Channels</h2>
                  <p>
                    Click a channel to connect it via OAuth, or continue without
                    channels — you can connect them later from the dashboard.
                  </p>
                </div>
              </div>
              <div className="button-row">
                <button onClick={() => setChannelsModalOpen(true)} type="button">
                  Open Connect Channels
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void handleCompleteChannels()}
                  type="button"
                >
                  {connectedChannels.length > 0 ? 'Continue' : 'Continue without channels'}
                </button>
              </div>
            </div>
          ) : null}

          {step === 'aiSetup' ? (
            <div className="onboarding-step-content">
              {settings ? (
                <AiWorkspace
                  codexCli={codexCli}
                  compactIntro
                  onSaved={async () => {
                    await handleAiSaved()
                  }}
                  saveLabel="Save and finish"
                  settings={settings}
                  showSaveButton
                />
              ) : (
                <p className="setup-copy">Sign in to configure AI generation.</p>
              )}
              <div className="button-row">
                <button
                  className="secondary-button"
                  onClick={() => void handleSkipAi()}
                  type="button"
                >
                  Skip for now and finish
                </button>
              </div>
            </div>
          ) : null}

          {message ? <p className="publish-state">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>

      <ConnectChannelsModal
        connectedChannels={connectedChannels}
        onClose={() => setChannelsModalOpen(false)}
        onContinue={() => void handleCompleteChannels()}
        open={channelsModalOpen}
        variant="onboarding"
      />
    </>
  )
}

function pickInitialStep(
  mode: WizardMode,
  stepCompleted: number,
  settings: PublicSettingsStatus | null,
): WizardStepId {
  if (mode === 'first-run') return 'account'
  if (stepCompleted < ONBOARDING_STEPS.createProject) return 'createProject'
  if (stepCompleted < ONBOARDING_STEPS.connectChannels) return 'connectChannels'
  if (!settings?.modelConfigured && stepCompleted < ONBOARDING_STEPS.complete) return 'aiSetup'
  return 'aiSetup'
}
