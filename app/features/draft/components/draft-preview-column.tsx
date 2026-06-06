import type { DraftVariantRow } from '../../../lib/db/draft-types'
import type { PublicProjectChannel } from '../../../lib/server/provider-accounts'
import { DraftPostPreview } from './draft-post-preview'

type DraftPreviewColumnProps = {
  variants: DraftVariantRow[]
  channels: PublicProjectChannel[]
  sourceTitle?: string | null
}

export function DraftPreviewColumn({
  variants,
  channels,
  sourceTitle,
}: Readonly<DraftPreviewColumnProps>) {
  const channelByProvider = new Map(channels.map((channel) => [channel.provider, channel]))

  return (
    <div className="draft-preview-column">
      <header className="draft-preview-column-header">
        <h2>Post preview</h2>
        <p>Live mockups for every channel in this draft.</p>
      </header>
      <div className="draft-preview-scroll">
        {variants.length ? (
          variants.map((variant) => (
            <DraftPostPreview
              channel={channelByProvider.get(variant.provider)}
              key={variant.id}
              linkUrl={variant.linkUrl}
              provider={variant.provider}
              sourceTitle={sourceTitle}
              text={variant.text}
            />
          ))
        ) : (
          <p className="empty">Select or generate a draft to see channel previews.</p>
        )}
      </div>
    </div>
  )
}
