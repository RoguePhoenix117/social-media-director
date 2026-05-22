import { Ban, CircleCheck, ShieldAlert } from 'lucide-react'

/**
 * Step-by-step X console instructions for deployers. Matches the current
 * console.x.com UI (Keys & tokens → OAuth 2.0 Keys). End users connect their
 * personal accounts later via Connect Channels — not here.
 */
export function XSetupGuide({ callbackUrl }: Readonly<{ callbackUrl: string }>) {
  const websiteUrl = originFromCallback(callbackUrl)

  return (
    <div className="setup-guide-stack">
      <div className="setup-callout setup-callout-warning" role="note">
        <ShieldAlert aria-hidden="true" size={18} />
        <div>
          <strong>You are registering the app — not connecting your personal X account.</strong>
          <p>
            Paste only the <strong>OAuth 2.0 Client ID</strong> and{' '}
            <strong>Client Secret</strong> from the console. Do not generate or paste
            Bearer Tokens, Access Tokens, or anything labeled for{' '}
            <strong>your own account</strong>.
          </p>
        </div>
      </div>

      <p className="field-guidance">
        Official reference:{' '}
        <a
          href="https://docs.x.com/fundamentals/authentication/oauth-2-0/overview"
          rel="noreferrer"
          target="_blank"
        >
          X OAuth 2.0 overview (docs.x.com)
        </a>
        . That flow is for <strong>applications</strong>; operators authorize this app
        later — you only register it here.
      </p>

      <section aria-labelledby="x-console-steps">
        <h3 className="setup-guide-heading" id="x-console-steps">
          In the X console (console.x.com)
        </h3>
        <ol className="friendly-steps">
          <li>
            Open your app (e.g. <code>Apps → social-media-director</code>).
          </li>
          <li>
            Go to the <strong>Keys &amp; tokens</strong> tab → next to{' '}
            <strong>OAuth 2.0 Keys</strong>, click <strong>Edit settings</strong> (or use
            the app <strong>Settings</strong> link).
          </li>
          <li>
            Under <strong>Authentication settings</strong>: choose{' '}
            <strong>Read and write</strong> and{' '}
            <strong>Web App, Automated App or Bot</strong>, then save.
          </li>
          <li>
            Under <strong>App info</strong>, set:
            <ul className="setup-sublist">
              <li>
                <strong>Callback URI / Redirect URL</strong> → paste the callback URL
                from this page (below)
              </li>
              <li>
                <strong>Website URL</strong> →{' '}
                <code>{websiteUrl || 'your APP_ORIGIN (e.g. http://127.0.0.1:5173)'}</code>
              </li>
            </ul>
          </li>
          <li>
            Return to <strong>Keys &amp; tokens</strong> → scroll to the{' '}
            <strong>OAuth 2.0 Keys</strong> section (not OAuth 1.0, not Bearer Token).
          </li>
          <li>
            Copy <strong>Client ID</strong> and <strong>Client Secret</strong> (click{' '}
            <strong>Show</strong> on the secret) into the fields at the bottom of this
            page.
          </li>
        </ol>
      </section>

      <div className="setup-credential-matrix">
        <section aria-labelledby="x-copy-these">
          <h4 className="setup-matrix-heading" id="x-copy-these">
            <CircleCheck aria-hidden="true" size={16} />
            Copy these (OAuth 2.0 Keys)
          </h4>
          <ul className="setup-matrix-list setup-matrix-list-yes">
            <li>
              <strong>Client ID</strong> — visible string in the OAuth 2.0 Keys block
            </li>
            <li>
              <strong>Client Secret</strong> — click Show, then copy (OAuth 2.0 Keys block
              only)
            </li>
          </ul>
        </section>

        <section aria-labelledby="x-never-copy">
          <h4 className="setup-matrix-heading" id="x-never-copy">
            <Ban aria-hidden="true" size={16} />
            Never copy these
          </h4>
          <ul className="setup-matrix-list setup-matrix-list-no">
            <li>
              <strong>Bearer Token</strong> (App-Only Authentication)
            </li>
            <li>
              <strong>OAuth 1.0 Keys</strong> — Consumer Key, Access Token, Generate
            </li>
            <li>
              <strong>OAuth 2.0 → Generate</strong> for your own account (@you) — that is
              a personal user token, not an app credential
            </li>
            <li>Any value labeled Access Token, Refresh Token, or API Key Secret</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

function originFromCallback(callbackUrl: string) {
  try {
    const url = new URL(callbackUrl)
    return url.origin
  } catch {
    return ''
  }
}
