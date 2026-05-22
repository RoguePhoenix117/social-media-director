import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { bootstrapQueryKey } from '../../lib/bootstrap-query'
import type { InstanceSetupStatus } from '../../server/setup'
import { saveInstanceSetup } from '../../server/setup'
import { instanceSetupQueryKey } from './setup-query'
import { SetupStepConfirm } from './setup-step-confirm'
import {
  LINKEDIN_CHECKLIST,
  SetupStepProvider,
} from './setup-step-provider'
import { SetupStepWelcome } from './setup-step-welcome'

type SetupStep = 'welcome' | 'x' | 'linkedin' | 'confirm'

const steps: ReadonlyArray<{ id: SetupStep; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'x', label: 'X app' },
  { id: 'linkedin', label: 'LinkedIn app' },
  { id: 'confirm', label: 'Confirm' },
]

export function SetupWizard({
  initialStatus,
  setupKey,
}: Readonly<{
  initialStatus: InstanceSetupStatus
  setupKey: string | undefined
}>) {
  const [status, setStatus] = useState(initialStatus)
  const [step, setStep] = useState<SetupStep>('welcome')
  const [xClientId, setXClientId] = useState('')
  const [xClientSecret, setXClientSecret] = useState('')
  const [linkedinClientId, setLinkedinClientId] = useState('')
  const [linkedinClientSecret, setLinkedinClientSecret] = useState('')
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const saveInstanceSetupFn = useServerFn(saveInstanceSetup)

  function nextStep() {
    setError(undefined)
    const next = steps[steps.findIndex((entry) => entry.id === step) + 1]
    if (next) setStep(next.id)
  }

  function prevStep() {
    setError(undefined)
    const prev = steps[steps.findIndex((entry) => entry.id === step) - 1]
    if (prev) setStep(prev.id)
  }

  function skipProviderStep() {
    setError(undefined)
    nextStep()
  }

  async function onSave() {
    setError(undefined)
    setIsSaving(true)
    try {
      const result = await saveInstanceSetupFn({
        data: {
          setupKey,
          xClientId: xClientId || undefined,
          xClientSecret: xClientSecret || undefined,
          linkedinClientId: linkedinClientId || undefined,
          linkedinClientSecret: linkedinClientSecret || undefined,
        },
      })
      setStatus(result)
      setXClientSecret('')
      setLinkedinClientSecret('')
      await queryClient.invalidateQueries({ queryKey: instanceSetupQueryKey })
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })
      if (result.configured) {
        await navigate({ to: '/' })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save setup.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="auth-shell setup-shell">
      <section className="auth-panel setup-panel">
        <header className="setup-panel-header">
          <p className="eyebrow">Instance setup</p>
          <h1>Configure OAuth app credentials</h1>
          <p className="page-summary">
            One-time setup for the deployer. Register an app at{' '}
            <a href="https://console.x.com/" rel="noreferrer" target="_blank">
              console.x.com
            </a>{' '}
            and LinkedIn Developers, then paste OAuth 2.0 client ID and secret for each
            provider you want. Skip any platform you do not need — operators cannot
            connect skipped providers until credentials are added later.
          </p>
        </header>

        <ol className="setup-stepper" aria-label="Setup progress">
          {steps.map((entry, index) => (
            <li
              aria-current={entry.id === step ? 'step' : undefined}
              className={getStepClass(entry.id, step, status, index)}
              key={entry.id}
            >
              <span className="setup-step-number">{index + 1}</span>
              <span>{entry.label}</span>
            </li>
          ))}
        </ol>

        {step === 'welcome' ? (
          <SetupStepWelcome status={status} onNext={nextStep} />
        ) : null}

        {step === 'x' ? (
          <SetupStepProvider
            callbackUrl={status.callbackUrls.x}
            clientId={xClientId}
            clientSecret={xClientSecret}
            heading="X (Twitter) developer app"
            onClientIdChange={(event) => setXClientId(event.target.value)}
            onClientSecretChange={(event) => setXClientSecret(event.target.value)}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipProviderStep}
            portalUrl="https://console.x.com/"
            provider="x"
            scopes={['tweet.read', 'tweet.write', 'users.read', 'offline.access']}
            status={status.providers.x}
          />
        ) : null}

        {step === 'linkedin' ? (
          <SetupStepProvider
            callbackUrl={status.callbackUrls.linkedin}
            clientId={linkedinClientId}
            clientSecret={linkedinClientSecret}
            heading="LinkedIn developer app"
            onClientIdChange={(event) => setLinkedinClientId(event.target.value)}
            onClientSecretChange={(event) => setLinkedinClientSecret(event.target.value)}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipProviderStep}
            portalUrl="https://www.linkedin.com/developers/apps"
            provider="linkedin"
            scopes={['openid', 'profile', 'w_member_social']}
            setupChecklist={LINKEDIN_CHECKLIST}
            status={status.providers.linkedin}
          />
        ) : null}

        {step === 'confirm' ? (
          <SetupStepConfirm
            draft={{
              x: { clientId: xClientId, clientSecret: xClientSecret },
              linkedin: { clientId: linkedinClientId, clientSecret: linkedinClientSecret },
            }}
            error={error}
            isSaving={isSaving}
            onPrev={prevStep}
            onSave={() => void onSave()}
            status={status}
          />
        ) : null}
      </section>
    </main>
  )
}

function getStepClass(
  candidate: SetupStep,
  current: SetupStep,
  status: InstanceSetupStatus,
  index: number,
) {
  if (candidate === current) return 'active'
  if (candidate === 'x' && status.providers.x.clientId && status.providers.x.clientSecretConfigured) {
    return 'done'
  }
  if (
    candidate === 'linkedin' &&
    status.providers.linkedin.clientId &&
    status.providers.linkedin.clientSecretConfigured
  ) {
    return 'done'
  }
  if (candidate === 'confirm' && status.configured) return 'done'
  if (index < steps.findIndex((entry) => entry.id === current)) return 'done'
  return ''
}
