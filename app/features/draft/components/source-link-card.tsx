import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { isBrowserHotlinkRiskyImageUrl } from '../../../lib/import/preview-image'

type SourceLinkCardProps = {
  title: string
  excerpt?: string | null
  canonicalUrl?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
}

export function SourceLinkCard({
  title,
  excerpt,
  canonicalUrl,
  sourceUrl,
  imageUrl,
}: Readonly<SourceLinkCardProps>) {
  const [imageFailed, setImageFailed] = useState(false)
  const href = canonicalUrl ?? sourceUrl
  const showImage =
    Boolean(imageUrl) && !imageFailed && !isBrowserHotlinkRiskyImageUrl(imageUrl)

  return (
    <article className="source-link-card">
      {showImage ? (
        <img
          alt=""
          className="source-link-card-image"
          onError={() => setImageFailed(true)}
          src={imageUrl!}
        />
      ) : null}
      <div className="source-link-card-body">
        <p className="source-link-card-title">{title}</p>
        {excerpt ? <p className="source-link-card-excerpt">{excerpt}</p> : null}
        {href ? (
          <a className="source-link-card-url" href={href} rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={14} />
            {href}
          </a>
        ) : null}
      </div>
    </article>
  )
}
