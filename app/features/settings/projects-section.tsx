import { Check, FolderKanban, FolderPlus, Plug } from 'lucide-react'
import { useState } from 'react'
import { CreateProjectScreen } from '../../components/create-project-screen'
import { TOTAL_CHANNEL_SLOTS } from '../../lib/channel-catalog'
import type { OperatorProject } from '../../lib/server/projects'

/**
 * Settings → Projects card. Lists every project the operator owns with a
 * channel-count badge and a "Switch" action, plus a single-field form to
 * create a new project. Reuses {@link CreateProjectScreen} so the
 * onboarding wizard and the settings page share the same form UI.
 *
 * Project mutations are owned by the parent (Settings page) so it can
 * decide what to do after a new project is created — for the PR6 happy
 * path, the parent opens the Connect Channels modal when the freshly
 * active project has zero channels.
 */
export function ProjectsSection({
  projects,
  activeProjectId,
  onCreate,
  onSwitch,
}: Readonly<{
  projects: ReadonlyArray<OperatorProject>
  activeProjectId: string | null
  onCreate: (input: { name: string }) => Promise<void>
  onSwitch: (projectId: string) => Promise<void>
}>) {
  const [showCreate, setShowCreate] = useState(projects.length === 0)
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null)

  async function handleSwitch(projectId: string) {
    if (projectId === activeProjectId) return
    setPendingSwitchId(projectId)
    try {
      await onSwitch(projectId)
    } finally {
      setPendingSwitchId(null)
    }
  }

  async function handleCreate(input: { name: string }) {
    await onCreate(input)
    setShowCreate(false)
  }

  return (
    <section className="template-card settings-section" id="projects">
      <div className="panel-heading">
        <FolderKanban aria-hidden="true" size={22} />
        <div>
          <h2>Projects</h2>
          <p>
            Each project is a separate workspace with its own X + LinkedIn channels,
            drafts, and publish history. Use multiple projects to manage multiple
            brands from a single operator account.
          </p>
        </div>
      </div>

      {projects.length > 0 ? (
        <ul aria-label="Your projects" className="projects-section-list">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId
            const isPending = pendingSwitchId === project.id
            return (
              <li
                className={isActive ? 'projects-section-item active' : 'projects-section-item'}
                key={project.id}
              >
                <div>
                  <p className="projects-section-item-name">{project.name}</p>
                  <div className="projects-section-item-meta">
                    <span>
                      <Plug aria-hidden="true" size={12} /> {project.connectedChannelCount}/
                      {TOTAL_CHANNEL_SLOTS} channels
                    </span>
                    <span>slug: {project.slug}</span>
                  </div>
                </div>
                <div className="projects-section-actions">
                  {isActive ? (
                    <span className="project-switcher-badge project-switcher-badge--complete">
                      <Check aria-hidden="true" size={12} />
                      Active
                    </span>
                  ) : (
                    <button
                      className="ghost-button"
                      disabled={isPending}
                      onClick={() => void handleSwitch(project.id)}
                      type="button"
                    >
                      {isPending ? 'Switching…' : 'Switch'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="setup-copy">No projects yet. Create your first one below.</p>
      )}

      {showCreate ? (
        <div className="projects-section-form">
          <CreateProjectScreen
            defaultName=""
            description="Pick a brand name or persona. We'll create the project, switch to it, and open Connect Channels so you can authorize X and LinkedIn."
            heading="Create a new project"
            onSubmit={handleCreate}
            submitLabel="Create project"
          />
          {projects.length > 0 ? (
            <button
              className="ghost-button"
              onClick={() => setShowCreate(false)}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : (
        <div className="button-row">
          <button onClick={() => setShowCreate(true)} type="button">
            <FolderPlus aria-hidden="true" size={17} />
            Create project
          </button>
        </div>
      )}
    </section>
  )
}
