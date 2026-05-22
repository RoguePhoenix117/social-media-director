import { KeyRound, ShieldAlert, Sparkles } from 'lucide-react'
import type { InstanceSetupStatus } from '../../server/setup'
import { LocalDevOriginGuide } from './local-dev-origin-guide'

export function SetupStepWelcome({
  status,
  onNext,
}: Readonly<{ status: InstanceSetupStatus; onNext: () => void }>) {
  return (
    <div className="setup-step-body">
      <div className="setup-callout">
        <p>
          <strong>You are the deployer.</strong> Setup Mode registers the OAuth apps that
          will let end users connect their personal X and LinkedIn accounts later via
          Connect Channels. Do not paste your own user access tokens here.
        </p>
      </div>

      {status.isLocalhost ? (
        <LocalDevOriginGuide provider="x" serverCallbackUrl={status.callbackUrls.x} />
      ) : null}

      <ul className="setup-checklist">
        <li>
          <Sparkles aria-hidden="true" size={18} />
          Optional OAuth apps at{' '}
          <a href="https://console.x.com/" rel="noreferrer" target="_blank">
            console.x.com
          </a>{' '}
          and LinkedIn Developers. Register only the platforms you need; skip the rest.
        </li>
        <li>
          <KeyRound aria-hidden="true" size={18} />
          Each app needs a client ID and client secret, saved to your project <code>.env</code>{' '}
          when you use the wizard or Settings → Developers.
        </li>
        <li>
          <ShieldAlert aria-hidden="true" size={18} />
          {status.setupKey.configured
            ? 'Setup is gated by INSTANCE_SETUP_KEY on non-localhost origins.'
            : 'No INSTANCE_SETUP_KEY is set. Configure one before exposing this instance to the internet.'}
        </li>
      </ul>

      <p className="field-guidance">
        Full walkthrough: <code>docs/developer-oauth-setup.md</code> (aligned with{' '}
        <a href="https://docs.x.com/overview" rel="noreferrer" target="_blank">
          docs.x.com
        </a>
        ). Operators never use this step — they connect via OAuth in Connect Channels
        after sign-up.
      </p>

      <div className="button-row">
        <button onClick={onNext} type="button">
          Start setup
        </button>
      </div>
    </div>
  )
}
