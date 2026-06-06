import type { Provider } from '../../../lib/domain/providers'
import type { PublicProjectChannel } from '../../../lib/server/provider-accounts'
import { PlatformIcon } from '../../../components/platform-icons'

type DraftPostPreviewProps = {
  provider: Provider
  channel: PublicProjectChannel | undefined
  text: string
  linkUrl?: string | null
  sourceTitle?: string | null
}

export function DraftPostPreview({
  provider,
  channel,
  text,
  linkUrl,
  sourceTitle,
}: Readonly<DraftPostPreviewProps>) {
  const displayName = channel?.displayName ?? providerLabel(provider)
  const handle = channel?.username ? `@${channel.username}` : providerLabel(provider)

  return (
    <article className={`draft-post-preview ${provider}`}>
      <header className="draft-post-preview-header">
        <span className="draft-post-preview-avatar">
          {channel?.profileImageUrl ? (
            <img alt="" src={channel.profileImageUrl} />
          ) : (
            <PlatformIcon platform={provider} size={20} />
          )}
        </span>
        <div>
          <strong>{displayName}</strong>
          <small>{handle}</small>
        </div>
        <span className="draft-post-preview-platform">
          <PlatformIcon platform={provider} size={16} />
        </span>
      </header>
      <p className="draft-post-preview-text">{text || 'Your post copy will appear here.'}</p>
      {linkUrl ? (
        <div className="draft-post-preview-link">
          <span className="draft-post-preview-link-domain">{linkHostname(linkUrl)}</span>
          {sourceTitle ? <strong>{sourceTitle}</strong> : null}
          <span className="draft-post-preview-link-url">{linkUrl}</span>
        </div>
      ) : null}
      {provider === 'linkedin' ? (
        <footer className="draft-post-preview-actions muted">
          <span>Like</span>
          <span>Comment</span>
          <span>Repost</span>
          <span>Send</span>
        </footer>
      ) : null}
    </article>
  )
}

function providerLabel(provider: Provider) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}

function linkHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
