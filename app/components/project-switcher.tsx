import { Check, ChevronsUpDown, FolderKanban, Plug } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { OperatorProject } from '../lib/server/projects'

/**
 * App-layout project switcher. Displays the active project name with a
 * dropdown of all projects the operator owns. Each entry shows the
 * connected-channel count badge so operators can see at a glance which
 * project still needs an OAuth connection.
 *
 * Switching is delegated to the parent (`onSwitch`) which calls the
 * `setActiveProject` server fn and refreshes the bootstrap cache. The
 * dropdown closes itself on outside click, escape, and after selection.
 */
export function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitch,
  totalChannelSlots,
  disabled,
}: Readonly<{
  projects: ReadonlyArray<OperatorProject>
  activeProjectId: string | null
  onSwitch: (projectId: string) => Promise<void>
  totalChannelSlots: number
  disabled?: boolean
}>) {
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!containerRef.current || !target) return
      if (!containerRef.current.contains(target)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (projects.length === 0) return null

  const active = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  if (!active) return null

  async function handleSelect(projectId: string) {
    if (projectId === active.id) {
      setOpen(false)
      return
    }
    setPendingId(projectId)
    try {
      await onSwitch(projectId)
      setOpen(false)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="project-switcher" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Switch project (current: ${active.name})`}
        className="project-switcher-button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <FolderKanban aria-hidden="true" size={16} />
        <span className="project-switcher-name">{active.name}</span>
        <span
          className={
            totalChannelSlots > 0 && active.connectedChannelCount >= totalChannelSlots
              ? 'project-switcher-badge project-switcher-badge--complete'
              : 'project-switcher-badge'
          }
        >
          <Plug aria-hidden="true" size={11} />
          {active.connectedChannelCount}/{totalChannelSlots}
        </span>
        <ChevronsUpDown aria-hidden="true" size={14} />
      </button>

      {open ? (
        <ul aria-label="Operator projects" className="project-switcher-menu" role="listbox">
          {projects.map((project) => {
            const isActive = project.id === active.id
            const isPending = pendingId === project.id
            return (
              <li key={project.id} role="presentation">
                <button
                  aria-selected={isActive}
                  className={isActive ? 'project-switcher-option active' : 'project-switcher-option'}
                  disabled={isPending}
                  onClick={() => void handleSelect(project.id)}
                  role="option"
                  type="button"
                >
                  <span className="project-switcher-option-name">{project.name}</span>
                  <span className="project-switcher-option-meta">
                    <Plug aria-hidden="true" size={11} />
                    {project.connectedChannelCount}/{totalChannelSlots}
                  </span>
                  {isActive ? <Check aria-hidden="true" size={14} /> : null}
                  {isPending ? <span className="project-switcher-spinner" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
