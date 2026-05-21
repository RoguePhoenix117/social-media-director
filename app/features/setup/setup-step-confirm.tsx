import { CheckCircle2 } from 'lucide-react'
import type { InstanceSetupStatus, ProviderSetupStatus } from '../../server/setup'

export function SetupStepConfirm({
  error,
  isSaving,
  onPrev,
  onSave,
  status,
}: Readonly<{
  error: string | undefined
  isSaving: boolean
  onPrev: () => void
  onSave: () => void
  status: InstanceSetupStatus
}>) {
  return (
    <div className="setup-step-body">
      <h2>Confirm and save</h2>
      <p className="field-guidance">
        Saving stores credentials encrypted, marks the instance as configured, and sends
        you to sign-up.
      </p>

      <ul className="setup-summary">
        <li>
          <ProviderSummary label="X" status={status.providers.x} />
        </li>
        <li>
          <ProviderSummary label="LinkedIn" status={status.providers.linkedin} />
        </li>
      </ul>

      {error ? <p className="error">{error}</p> : null}

      <div className="button-row">
        <button className="secondary-button" onClick={onPrev} type="button">
          Back
        </button>
        <button disabled={isSaving} onClick={onSave} type="button">
          {isSaving ? 'Saving…' : 'Save and finish setup'}
        </button>
      </div>
    </div>
  )
}

function ProviderSummary({
  label,
  status,
}: Readonly<{
  label: string
  status: ProviderSetupStatus
}>) {
  const ready = Boolean(status.clientId && status.clientSecretConfigured)
  return (
    <div className={ready ? 'auth-state-card connected' : 'auth-state-card unavailable'}>
      <CheckCircle2 aria-hidden="true" size={18} />
      <div>
        <strong>{label}</strong>
        <p>
          {ready
            ? status.source === 'env'
              ? 'Ready (sourced from environment).'
              : 'Ready (saved to database).'
            : 'Missing client ID or secret. Go back and complete this step.'}
        </p>
      </div>
    </div>
  )
}
