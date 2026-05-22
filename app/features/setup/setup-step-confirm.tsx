import { CheckCircle2, CircleDashed } from 'lucide-react'
import type { InstanceSetupStatus, ProviderSetupStatus } from '../../server/setup'

type ProviderDraft = {
  clientId: string
  clientSecret: string
}

export function SetupStepConfirm({
  draft,
  error,
  isSaving,
  onPrev,
  onSave,
  status,
}: Readonly<{
  draft: {
    x: ProviderDraft
    linkedin: ProviderDraft
  }
  error: string | undefined
  isSaving: boolean
  onPrev: () => void
  onSave: () => void
  status: InstanceSetupStatus
}>) {
  const xReady = isProviderReady(status.providers.x, draft.x)
  const linkedinReady = isProviderReady(status.providers.linkedin, draft.linkedin)
  const enabledCount = (xReady ? 1 : 0) + (linkedinReady ? 1 : 0)

  return (
    <div className="setup-step-body">
      <h2>Confirm and save</h2>
      <p className="field-guidance">
        Saving writes any credentials you entered to <code>.env</code>, marks setup complete,
        and applies credentials to the running server without a restart.
        and sends you to sign-up.
        {enabledCount === 0
          ? ' You chose not to enable social OAuth — you can add providers later in Settings → Developers.'
          : null}
      </p>

      <ul className="setup-summary">
        <li>
          <ProviderSummary
            draft={draft.x}
            label="X"
            status={status.providers.x}
          />
        </li>
        <li>
          <ProviderSummary
            draft={draft.linkedin}
            label="LinkedIn"
            status={status.providers.linkedin}
          />
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

function isProviderReady(status: ProviderSetupStatus, draft: ProviderDraft): boolean {
  if (status.source === 'env' && status.clientSecretConfigured) return true
  if (status.clientId && status.clientSecretConfigured) return true
  return Boolean(draft.clientId.trim() && draft.clientSecret.trim())
}

function ProviderSummary({
  draft,
  label,
  status,
}: Readonly<{
  draft: ProviderDraft
  label: string
  status: ProviderSetupStatus
}>) {
  const ready = isProviderReady(status, draft)
  return (
    <div className={ready ? 'auth-state-card connected' : 'auth-state-card unavailable'}>
      {ready ? (
        <CheckCircle2 aria-hidden="true" size={18} />
      ) : (
        <CircleDashed aria-hidden="true" size={18} />
      )}
      <div>
        <strong>{label}</strong>
        <p>
          {ready
            ? status.source === 'env'
              ? 'Ready (already in .env).'
              : 'Ready (will be written to .env).'
            : 'Skipped — operators cannot connect this provider until credentials are added.'}
        </p>
      </div>
    </div>
  )
}
