import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { DraftListItem, MasterPostStatus } from '../../lib/db/draft-types'

const statusTabs: Array<{ value: MasterPostStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'published', label: 'Published' },
]

export function DraftList({
  drafts,
  activeTab,
  onTabChange,
}: Readonly<{
  drafts: DraftListItem[]
  activeTab: MasterPostStatus | 'all'
  onTabChange: (tab: MasterPostStatus | 'all') => void
}>) {
  const filtered =
    activeTab === 'all' ? drafts : drafts.filter((draft) => draft.status === activeTab)

  return (
    <section className="draft-list-panel">
      <div className="draft-list-header">
        <div>
          <h2>Project drafts</h2>
          <p>Import content, edit platform variants, and mark ready for the Post calendar.</p>
        </div>
        <Link className="button-link primary" search={{ id: undefined }} to="/draft">
          <Plus aria-hidden="true" size={16} />
          New draft
        </Link>
      </div>

      <div className="draft-status-tabs" role="tablist">
        {statusTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.value}
            className={activeTab === tab.value ? 'active' : undefined}
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No drafts in this tab yet. Create one from a blog URL.</p>
      ) : (
        <ul className="draft-list">
          {filtered.map((draft) => (
            <li key={draft.id}>
              <Link
                className="draft-list-item"
                search={{ id: draft.id }}
                to="/draft"
              >
                <div>
                  <p className="eyebrow">{draft.sourceTitle ?? draft.summary}</p>
                  <h3>{draft.summary}</h3>
                  {draft.sourceUrl ? <span className="draft-meta">{draft.sourceUrl}</span> : null}
                </div>
                <span className={`status-pill ${draft.status}`}>{draft.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
