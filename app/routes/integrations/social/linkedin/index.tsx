import { createFileRoute } from '@tanstack/react-router'
import { startLinkedInOAuth } from '../../../../server/channels'

/**
 * Start of the LinkedIn OAuth 2.0 (Authorization Code) flow.
 *
 * URL: `/integrations/social/linkedin` — implemented as `linkedin/index.tsx`
 * (rather than `linkedin.tsx`) so that visiting the sibling
 * `linkedin/callback` route does NOT inherit this loader's authorize redirect.
 * Mirrors the X start route at `/integrations/social/x`.
 */

export const Route = createFileRoute('/integrations/social/linkedin/')({
  loader: () => startLinkedInOAuth(),
  component: StartingLinkedInOAuth,
})

function StartingLinkedInOAuth() {
  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Connecting LinkedIn</p>
        <h1>Redirecting to LinkedIn…</h1>
        <p>Hold tight while we hand you off to LinkedIn to authorize Social Media Director.</p>
      </section>
    </main>
  )
}
