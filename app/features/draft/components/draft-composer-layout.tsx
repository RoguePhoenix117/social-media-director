import type { ReactNode } from 'react'

export function DraftComposerLayout({
  editor,
  preview,
}: Readonly<{
  editor: ReactNode
  preview: ReactNode
}>) {
  return (
    <div className="draft-composer-layout">
      <section aria-label="Draft editor" className="draft-composer-editor">
        {editor}
      </section>
      <aside aria-label="Post preview" className="draft-composer-preview">
        {preview}
      </aside>
    </div>
  )
}
