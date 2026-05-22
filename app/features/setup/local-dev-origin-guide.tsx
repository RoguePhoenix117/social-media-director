import { Globe, Info } from 'lucide-react'
import { useBrowserAppOrigin } from '../../hooks/use-browser-app-origin'
import {
  buildProviderCallbackUrls,
  originFromUrl,
  resolveProviderCallbackUrl,
} from '../../lib/browser-app-origin'
import { normalizeLocalDevOrigin } from '../../lib/local-dev-origin'
import { CallbackUrlField } from './setup-callback-url'

/**
 * Shows the URLs non-developers should paste into console.x.com / LinkedIn
 * Developers, derived from the tab they actually have open (port included).
 */
export function LocalDevOriginGuide({
  provider,
  serverCallbackUrl,
}: Readonly<{
  provider: 'x' | 'linkedin'
  serverCallbackUrl: string
}>) {
  const browserOrigin = useBrowserAppOrigin()
  const appOrigin =
    browserOrigin ?? normalizeLocalDevOrigin(originFromUrl(serverCallbackUrl) || '')
  const callbackUrl = resolveProviderCallbackUrl(browserOrigin, serverCallbackUrl, provider)
  const serverOrigin = normalizeLocalDevOrigin(originFromUrl(serverCallbackUrl))
  const originMismatch =
    Boolean(browserOrigin) && Boolean(serverOrigin) && browserOrigin !== serverOrigin
  const onLocalhost =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const switchHref =
    browserOrigin && typeof window !== 'undefined'
      ? `${browserOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : null

  if (!appOrigin) return null

  const providerLabel = provider === 'x' ? 'X' : 'LinkedIn'

  return (
    <section aria-labelledby="local-dev-origin-guide" className="setup-callout local-dev-origin-guide">
      <div className="local-dev-origin-guide-header">
        <Globe aria-hidden="true" size={18} />
        <div>
          <h3 className="setup-guide-heading" id="local-dev-origin-guide">
            Use these URLs in the {providerLabel} developer console
          </h3>
          <p>
            Taken from the address bar of this tab — including the port. The{' '}
            <code>localhost:5173</code> link in the terminal can differ; trust what
            you see here instead.
          </p>
        </div>
      </div>

      {onLocalhost && switchHref ? (
        <p className="field-guidance">
          You are on <code>localhost</code>. For {providerLabel}, open this page at{' '}
          <a href={switchHref}>{browserOrigin}</a> (X rejects the hostname{' '}
          <code>localhost</code>).
        </p>
      ) : null}

      <CallbackUrlField label="App URL (Website URL in X console)" url={appOrigin} />
      <CallbackUrlField
        label={`${providerLabel} callback URL (paste into developer portal)`}
        url={callbackUrl}
      />

      {originMismatch ? (
        <div className="setup-callout setup-callout-warning local-dev-origin-mismatch" role="note">
          <Info aria-hidden="true" size={16} />
          <p>
            Your browser is on <code>{browserOrigin}</code>, but{' '}
            <code>APP_ORIGIN</code> in <code>.env</code> may still point elsewhere (
            <code>{serverOrigin}</code>). Add or update{' '}
            <code>APP_ORIGIN={browserOrigin}</code> in <code>.env</code>, then restart{' '}
            <code>pnpm dev</code> so OAuth keeps working after a restart.
          </p>
        </div>
      ) : (
        <p className="field-guidance">
          After setup, keep using <code>{appOrigin}</code> in your browser — not{' '}
          <code>localhost</code> with a different port.
        </p>
      )}
    </section>
  )
}

export function LocalDevOriginSummary({
  xCallbackUrl,
  linkedinCallbackUrl,
}: Readonly<{
  xCallbackUrl: string
  linkedinCallbackUrl: string
}>) {
  const browserOrigin = useBrowserAppOrigin()
  const appOrigin =
    browserOrigin ??
    normalizeLocalDevOrigin(originFromUrl(xCallbackUrl) || originFromUrl(linkedinCallbackUrl))
  const urls = appOrigin ? buildProviderCallbackUrls(appOrigin) : null

  if (!appOrigin || !urls) return null

  return (
    <section aria-labelledby="dev-origin-summary" className="setup-callout local-dev-origin-guide">
      <div className="local-dev-origin-guide-header">
        <Globe aria-hidden="true" size={18} />
        <div>
          <h3 className="setup-guide-heading" id="dev-origin-summary">
            Registered app URLs
          </h3>
          <p>Based on this browser tab. Paste these if you edit OAuth apps later.</p>
        </div>
      </div>
      <CallbackUrlField label="App URL" url={appOrigin} />
      <CallbackUrlField label="X callback URL" url={urls.x} />
      <CallbackUrlField label="LinkedIn callback URL" url={urls.linkedin} />
    </section>
  )
}
