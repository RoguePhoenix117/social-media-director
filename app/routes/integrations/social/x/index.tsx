import { createFileRoute } from '@tanstack/react-router'
import { startXOAuth } from '../../../../server/channels'

/**
 * Start of the X OAuth 2.0 PKCE flow.
 *
 * URL: `/integrations/social/x` — implemented as `x/index.tsx` (rather than
 * `x.tsx`) so that visiting the sibling `x/callback` route does NOT inherit
 * this loader's authorize redirect.
 */

export const Route = createFileRoute('/integrations/social/x/')({
  loader: () => startXOAuth(),
  component: StartingXOAuth,
})

function StartingXOAuth() {
  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Connecting X</p>
        <h1>Redirecting to X…</h1>
        <p>Hold tight while we hand you off to X to authorize Social Media Director.</p>
      </section>
    </main>
  )
}
