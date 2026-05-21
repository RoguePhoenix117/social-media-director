import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { completeXOAuth } from '../../../../server/channels'

/**
 * X OAuth 2.0 callback. Exchanges the authorization code for tokens, fetches
 * the user profile, and upserts the project's `provider_accounts` row before
 * redirecting to the "Adding Channel" interstitial.
 */

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/integrations/social/x/callback')({
  validateSearch: callbackSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    completeXOAuth({
      data: {
        code: deps.code,
        state: deps.state,
        error: deps.error,
        error_description: deps.error_description,
      },
    }),
  component: ProcessingXCallback,
})

function ProcessingXCallback() {
  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Connecting X</p>
        <h1>Finishing up…</h1>
        <p>Saving your X connection. You will be redirected automatically.</p>
      </section>
    </main>
  )
}
