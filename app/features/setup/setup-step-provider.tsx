import type { ChangeEvent, ReactNode } from 'react'
import { resolveProviderCallbackUrl } from '../../lib/browser-app-origin'
import { useBrowserAppOrigin } from '../../hooks/use-browser-app-origin'
import type { InstanceSetupStatus } from '../../server/setup'
import { LocalDevOriginGuide } from './local-dev-origin-guide'
import { ProviderCredentialFields } from './provider-credential-fields'
import { XSetupGuide } from './x-setup-guide'

export const LINKEDIN_CHECKLIST: ReadonlyArray<string> = [
  'Create an app at LinkedIn Developers (linkedin.com/developers/apps).',
  'Add the Share on LinkedIn and Sign In with LinkedIn using OpenID Connect products.',
  'Set the Authorized redirect URL to the callback URL below.',
  'Copy the Client ID and Client Secret from the Auth tab.',
]

export function SetupStepProvider({
  callbackUrl,
  clientId,
  clientSecret,
  heading,
  onClientIdChange,
  onClientSecretChange,
  onNext,
  onPrev,
  onSkip,
  portalUrl,
  provider,
  scopes,
  setupChecklist,
  setupGuide,
  status,
}: Readonly<{
  callbackUrl: string
  clientId: string
  clientSecret: string
  heading: string
  onClientIdChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClientSecretChange: (event: ChangeEvent<HTMLInputElement>) => void
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  portalUrl: string
  provider: 'x' | 'linkedin'
  scopes: ReadonlyArray<string>
  /** Simple numbered list — used for LinkedIn. */
  setupChecklist?: ReadonlyArray<string>
  /** Rich instructions — used for X (console-specific do / don't). */
  setupGuide?: ReactNode
  status: InstanceSetupStatus['providers']['x']
}>) {
  const configuredViaEnv = status.source === 'env' && status.clientSecretConfigured
  const browserOrigin = useBrowserAppOrigin()
  const effectiveCallbackUrl = resolveProviderCallbackUrl(
    browserOrigin,
    callbackUrl,
    provider,
  )

  return (
    <div className="setup-step-body">
      <header className="setup-step-heading">
        <h2>{heading}</h2>
        <a href={portalUrl} rel="noreferrer" target="_blank">
          {provider === 'x' ? 'Open X console →' : 'Open developer portal →'}
        </a>
      </header>

      <LocalDevOriginGuide provider={provider} serverCallbackUrl={callbackUrl} />

      <p className="field-guidance">
        Optional — skip this step if you do not need {provider === 'x' ? 'X' : 'LinkedIn'} on this
        instance. Operators cannot connect a provider until you register it here or in Settings →
        Developers.
      </p>

      {setupChecklist && setupChecklist.length > 0 ? (
        <ol className="friendly-steps">
          {setupChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}

      {setupGuide}

      {provider === 'x' ? <XSetupGuide callbackUrl={effectiveCallbackUrl} /> : null}

      <p className="field-guidance">
        End-user OAuth scopes (applied when someone clicks Connect X later):{' '}
        <code>{scopes.join(' ')}</code>
      </p>

      <h3 className="setup-guide-heading">Paste app credentials here</h3>

      <ProviderCredentialFields
        callbackUrl={effectiveCallbackUrl}
        clientId={clientId}
        clientSecret={clientSecret}
        onClientIdChange={onClientIdChange}
        onClientSecretChange={onClientSecretChange}
        provider={provider}
        status={status}
      />

      <div className="button-row">
        <button className="secondary-button" onClick={onPrev} type="button">
          Back
        </button>
        {configuredViaEnv ? null : (
          <button className="secondary-button" onClick={onSkip} type="button">
            Skip {provider === 'x' ? 'X' : 'LinkedIn'}
          </button>
        )}
        <button onClick={onNext} type="button">
          Continue
        </button>
      </div>
    </div>
  )
}
