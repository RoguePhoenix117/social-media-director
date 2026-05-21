import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

/**
 * "Adding Channel…" interstitial. Reached via redirect from
 * `/integrations/social/{provider}/callback` after a successful token
 * exchange. We auto-forward to `/?channel_connected=...` so the dashboard
 * can render a confirmation toast; the interstitial is a UX nicety so the
 * redirect chain isn't a blank page.
 */

const PROVIDER_LABELS: Record<string, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
}

const searchSchema = z.object({
  provider: z.enum(['x', 'linkedin']).optional(),
  next: z.string().optional(),
})

export const Route = createFileRoute('/integrations/social/adding')({
  validateSearch: searchSchema,
  component: AddingChannelInterstitial,
})

function AddingChannelInterstitial() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const provider = search.provider ?? 'x'
  const label = PROVIDER_LABELS[provider] ?? 'channel'

  useEffect(() => {
    const timer = setTimeout(() => {
      void navigate({ to: '/', search: { channel_connected: provider } as never })
    }, 1200)
    return () => clearTimeout(timer)
  }, [navigate, provider])

  return (
    <main className="fallback-shell">
      <section className="fallback-panel">
        <p className="eyebrow">Adding Channel</p>
        <h1>Adding {label}…</h1>
        <p>Hang tight — we are syncing your account. You will be redirected automatically.</p>
        <Link className="button-link" to="/">
          Continue
        </Link>
      </section>
    </main>
  )
}
