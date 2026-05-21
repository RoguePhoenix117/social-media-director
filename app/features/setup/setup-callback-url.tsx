import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Display a callback URL with a copy-to-clipboard button. The visual treatment
 * is shared between Setup Mode and Settings → Developers so the user sees the
 * exact value to paste into the provider's developer portal.
 */
export function CallbackUrlField({
  label,
  url,
}: Readonly<{ label: string; url: string }>) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="callback-url-row">
      <span className="field-label">{label}</span>
      <div className="input-with-action">
        <input readOnly type="text" value={url} />
        <button
          aria-label={copied ? 'Callback URL copied' : 'Copy callback URL'}
          className="secondary-button"
          onClick={() => void copy()}
          type="button"
        >
          {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
