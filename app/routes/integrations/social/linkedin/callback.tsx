import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { completeLinkedInOAuth } from '../../../../server/channels'

/**
 * LinkedIn OAuth 2.0 callback. Exchanges the authorization code for tokens,
 * fetches the OIDC userinfo profile, and upserts the project's
 * `provider_accounts` row (including `author_urn = urn:li:person:{sub}`)
 * before redirecting to the "Adding Channel" interstitial.
 */

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/integrations/social/linkedin/callback')({
  validateSearch: callbackSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    completeLinkedInOAuth({
      data: {
        code: deps.code,
        state: deps.state,
        error: deps.error,
        error_description: deps.error_description,
      },
    }),
  component: ProcessingLinkedInCallback,
})

function ProcessingLinkedInCallback() {
  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Connecting LinkedIn</p>
        <h1>Finishing up…</h1>
        <p>Saving your LinkedIn connection. You will be redirected automatically.</p>
      </section>
    </main>
  )
}
