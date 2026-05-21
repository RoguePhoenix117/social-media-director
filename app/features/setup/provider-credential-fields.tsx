import { ShieldCheck } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { ProviderSetupStatus } from '../../server/setup'
import { CallbackUrlField } from './setup-callback-url'

/**
 * Pair of client ID + secret inputs for a single OAuth provider.
 * When credentials are sourced from `process.env` the fields render read-only
 * with a clear badge so the deployer knows to update env vars instead.
 */
export function ProviderCredentialFields({
  provider,
  status,
  callbackUrl,
  clientId,
  clientSecret,
  secretPlaceholder,
  onClientIdChange,
  onClientSecretChange,
}: Readonly<{
  provider: 'x' | 'linkedin'
  status: ProviderSetupStatus
  callbackUrl: string
  clientId: string
  clientSecret: string
  secretPlaceholder?: string
  onClientIdChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClientSecretChange: (event: ChangeEvent<HTMLInputElement>) => void
}>) {
  const isEnv = status.source === 'env'
  const clientIdName = `${provider}ClientId`
  const clientSecretName = `${provider}ClientSecret`

  return (
    <div className="provider-credential-fields">
      {isEnv ? (
        <div className="auth-state-card connected" role="status">
          <ShieldCheck aria-hidden="true" size={18} />
          <div>
            <strong>Configured via environment variables</strong>
            <p>
              These credentials are set in your <code>.env</code> file and cannot be edited
              from the UI. Update the env file and restart to change them.
            </p>
          </div>
        </div>
      ) : null}

      <CallbackUrlField label="Callback URL (paste into developer portal)" url={callbackUrl} />

      <label className="form-field">
        <span className="field-label">Client ID</span>
        <input
          autoComplete="off"
          disabled={isEnv}
          name={clientIdName}
          onChange={onClientIdChange}
          placeholder={isEnv ? 'Set via environment' : status.clientId ?? 'Paste client ID'}
          spellCheck={false}
          type="text"
          value={isEnv ? status.clientId ?? '' : clientId}
        />
      </label>

      <label className="form-field">
        <span className="field-label">Client secret</span>
        <input
          autoComplete="off"
          disabled={isEnv}
          name={clientSecretName}
          onChange={onClientSecretChange}
          placeholder={
            isEnv
              ? 'Set via environment'
              : secretPlaceholder ??
                (status.clientSecretConfigured ? 'Configured — paste to replace' : 'Paste client secret')
          }
          spellCheck={false}
          type="password"
          value={isEnv ? '' : clientSecret}
        />
        <small className="field-guidance">
          Stored encrypted in <code>instance_config</code>. The secret is never returned to the
          browser after saving.
        </small>
      </label>
    </div>
  )
}
