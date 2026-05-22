import { ShieldCheck } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { ProviderSetupStatus } from '../../server/setup'
import { CallbackUrlField } from './setup-callback-url'

/**
 * Pair of client ID + secret inputs for a single OAuth provider.
 * Saving writes to the project-root `.env` — never to Postgres.
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
  const isConfigured = status.source === 'env'
  const clientIdName = `${provider}ClientId`
  const clientSecretName = `${provider}ClientSecret`
  const displayClientId = clientId || status.clientId || ''

  return (
    <div className="provider-credential-fields">
      {isConfigured ? (
        <div className="auth-state-card connected" role="status">
          <ShieldCheck aria-hidden="true" size={18} />
          <div>
            <strong>Configured in `.env`</strong>
            <p>
              Values are loaded from your project-root <code>.env</code> file. Saving here
              updates those lines only — other env vars are left untouched.
            </p>
          </div>
        </div>
      ) : null}

      <CallbackUrlField label="Callback URL (paste into developer portal)" url={callbackUrl} />

      <label className="form-field">
        <span className="field-label">
          {provider === 'x' ? 'OAuth 2.0 Client ID' : 'Client ID'}
        </span>
        <input
          autoComplete="off"
          name={clientIdName}
          onChange={onClientIdChange}
          placeholder={
            provider === 'x'
              ? 'From Keys & tokens → OAuth 2.0 Keys'
              : status.clientId ?? 'Paste client ID'
          }
          spellCheck={false}
          type="text"
          value={displayClientId}
        />
      </label>

      <label className="form-field">
        <span className="field-label">
          {provider === 'x' ? 'OAuth 2.0 Client Secret' : 'Client secret'}
        </span>
        <input
          autoComplete="off"
          name={clientSecretName}
          onChange={onClientSecretChange}
          placeholder={
            secretPlaceholder ??
            (provider === 'x'
              ? status.clientSecretConfigured
                ? 'Leave blank to keep current .env value'
                : 'From OAuth 2.0 Keys — click Show in console'
              : status.clientSecretConfigured
                ? 'Leave blank to keep current .env value'
                : 'Paste client secret')
          }
          spellCheck={false}
          type="password"
          value={clientSecret}
        />
        <small className="field-guidance">
          Written to <code>.env</code> on save. The secret is never returned to the browser
          after saving.
        </small>
      </label>
    </div>
  )
}
