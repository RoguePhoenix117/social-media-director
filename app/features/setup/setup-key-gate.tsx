import { ShieldAlert } from 'lucide-react'
import type { InstanceSetupStatus } from '../../server/setup'

/**
 * Rendered when a setup key is required (non-localhost origin + INSTANCE_SETUP_KEY)
 * but the visitor did not supply a valid `?setup_key=` query parameter. We do
 * not echo back the expected key — only the gate UI and instructions.
 */
export function SetupKeyGate({ status }: Readonly<{ status: InstanceSetupStatus }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <header>
          <p className="eyebrow">Instance not configured</p>
          <h1>
            <ShieldAlert aria-hidden="true" size={22} /> Setup key required
          </h1>
        </header>
        <p className="setup-copy">
          This Social Media Director instance has not been configured yet, and the
          deployer protected setup with <code>INSTANCE_SETUP_KEY</code>.
        </p>
        <p className="setup-copy">
          Append <code>?setup_key=YOUR_KEY</code> to the URL with the value of the
          deployment's <code>INSTANCE_SETUP_KEY</code> environment variable, then reload.
        </p>
        <p className="field-guidance">Detected origin: {status.origin}</p>
      </section>
    </main>
  )
}
