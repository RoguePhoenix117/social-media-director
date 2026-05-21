import { KeyRound, ShieldAlert, Sparkles } from 'lucide-react'
import type { InstanceSetupStatus } from '../../server/setup'

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
          Connect Channels (PR4). Do not paste your own user access tokens here.
        </p>
      </div>

      <ul className="setup-checklist">
        <li>
          <Sparkles aria-hidden="true" size={18} />
          Two OAuth apps required: one at the X Developer Portal and one at the LinkedIn
          Developer Portal.
        </li>
        <li>
          <KeyRound aria-hidden="true" size={18} />
          Each app needs a client ID and client secret. The secret is stored encrypted
          in <code>instance_config</code>.
        </li>
        <li>
          <ShieldAlert aria-hidden="true" size={18} />
          {status.setupKey.configured
            ? 'Setup is gated by INSTANCE_SETUP_KEY on non-localhost origins.'
            : 'No INSTANCE_SETUP_KEY is set. Configure one before exposing this instance to the internet.'}
        </li>
      </ul>

      <p className="field-guidance">
        Detailed portal instructions ship with PR6 in <code>docs/developer-oauth-setup.md</code>.
        Until then, each step below summarises the minimum portal configuration.
      </p>

      <div className="button-row">
        <button onClick={onNext} type="button">
          Start setup
        </button>
      </div>
    </div>
  )
}
