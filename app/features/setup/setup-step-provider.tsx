import type { ChangeEvent } from 'react'
import type { InstanceSetupStatus } from '../../server/setup'
import { ProviderCredentialFields } from './provider-credential-fields'

export const X_CHECKLIST: ReadonlyArray<string> = [
  'Create a Project + App at the X Developer Portal.',
  'Under User authentication settings, choose Read and Write, App type Web App, then paste the callback URL below.',
  'Copy the OAuth 2.0 Client ID and Client Secret (NOT the API Key or Bearer Token).',
]

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
  portalUrl,
  provider,
  scopes,
  setupChecklist,
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
  portalUrl: string
  provider: 'x' | 'linkedin'
  scopes: ReadonlyArray<string>
  setupChecklist: ReadonlyArray<string>
  status: InstanceSetupStatus['providers']['x']
}>) {
  return (
    <div className="setup-step-body">
      <header className="setup-step-heading">
        <h2>{heading}</h2>
        <a href={portalUrl} rel="noreferrer" target="_blank">
          Open developer portal →
        </a>
      </header>

      <ol className="friendly-steps">
        {setupChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>

      <p className="field-guidance">
        Requested OAuth scopes: <code>{scopes.join(' ')}</code>
      </p>

      <ProviderCredentialFields
        callbackUrl={callbackUrl}
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
        <button onClick={onNext} type="button">
          Continue
        </button>
      </div>
    </div>
  )
}
