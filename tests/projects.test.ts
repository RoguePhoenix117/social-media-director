import { beforeEach, describe, expect, it, vi } from 'vitest'

type ProjectRecord = {
  id: string
  name: string
  slug: string
  channels_onboarding_completed: boolean
  created_at: string
  updated_at: string
}

type OperatorProjectRecord = {
  operator_id: string
  project_id: string
  role: string
  created_at: string
}

type SessionRecord = {
  id: string
  active_project_id: string | null
}

const projects = new Map<string, ProjectRecord>()
const operatorProjects: OperatorProjectRecord[] = []
const sessions = new Map<string, SessionRecord>()
const channelCounts = new Map<string, number>()
let nextProjectId = 1

function mockClient() {
  return {
    query: vi.fn(handleQuery),
    release: vi.fn(),
  }
}

vi.mock('../app/lib/db/client', () => ({
  getDb: () => ({
    query: vi.fn(handleQuery),
    connect: vi.fn(async () => mockClient()),
  }),
}))

async function handleQuery(sql: string, params: unknown[] = []) {
  if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] }

  if (sql.includes('select slug from projects where slug =')) {
    const base = params[0] as string
    const prefix = (params[1] as string).slice(0, -1)
    const rows: Array<{ slug: string }> = []
    for (const project of projects.values()) {
      if (project.slug === base || project.slug.startsWith(prefix)) {
        rows.push({ slug: project.slug })
      }
    }
    return { rows }
  }

  if (sql.includes('insert into projects')) {
    const id = `project-${nextProjectId++}`
    const now = new Date().toISOString()
    const record: ProjectRecord = {
      id,
      name: params[0] as string,
      slug: params[1] as string,
      channels_onboarding_completed: false,
      created_at: now,
      updated_at: now,
    }
    projects.set(id, record)
    return { rows: [record] }
  }

  if (sql.includes('insert into operator_projects')) {
    operatorProjects.push({
      operator_id: params[0] as string,
      project_id: params[1] as string,
      role: (params[2] as string) ?? 'owner',
      created_at: new Date().toISOString(),
    })
    return { rows: [] }
  }

  if (sql.includes('lower(trim(p.name))')) {
    const operatorId = params[0] as string
    const name = String(params[1]).trim().toLowerCase()
    const exists = operatorProjects.some((row) => {
      if (row.operator_id !== operatorId) return false
      const project = projects.get(row.project_id)
      return project?.name.trim().toLowerCase() === name
    })
    return { rows: exists ? [{ exists: true }] : [] }
  }

  if (sql.includes('select') && sql.includes('from projects') && sql.includes('join operator_projects')) {
    const operatorId = params[0] as string
    const rows = operatorProjects
      .filter((row) => row.operator_id === operatorId)
      .map((row) => {
        const project = projects.get(row.project_id)!
        return {
          ...project,
          role: row.role,
          connected_channel_count: channelCounts.get(row.project_id) ?? 0,
        }
      })
    return { rows }
  }

  if (sql.includes('from projects') && sql.includes('where id = $1')) {
    const project = projects.get(params[0] as string)
    return { rows: project ? [project] : [] }
  }

  if (sql.includes('select true as exists') && sql.includes('from operator_projects')) {
    const exists = operatorProjects.some(
      (row) => row.operator_id === params[0] && row.project_id === params[1],
    )
    return { rows: exists ? [{ exists: true }] : [] }
  }

  if (sql.includes('update operator_sessions') && sql.includes('set active_project_id')) {
    const sessionId = params[0] as string
    const projectId = params[1] as string | null
    const existing = sessions.get(sessionId) ?? { id: sessionId, active_project_id: null }
    sessions.set(sessionId, { ...existing, active_project_id: projectId })
    return { rows: [] }
  }

  throw new Error(`Unexpected query: ${sql}`)
}

describe('projects', () => {
  beforeEach(() => {
    projects.clear()
    operatorProjects.length = 0
    sessions.clear()
    channelCounts.clear()
    nextProjectId = 1
  })

  it('creates a project and associates the operator as owner', async () => {
    const { createProject } = await import('../app/lib/server/projects')

    const project = await createProject({ operatorId: 'operator-1', name: 'My Brand' })

    expect(project).toMatchObject({
      name: 'My Brand',
      slug: 'my-brand',
      role: 'owner',
      channelsOnboardingCompleted: false,
    })
    expect(operatorProjects).toEqual([
      expect.objectContaining({ operator_id: 'operator-1', project_id: project.id, role: 'owner' }),
    ])
  })

  it('rejects duplicate project names for the same operator', async () => {
    const { createProject } = await import('../app/lib/server/projects')

    await createProject({ operatorId: 'operator-1', name: 'My Brand' })

    await expect(createProject({ operatorId: 'operator-1', name: 'My Brand' })).rejects.toThrow(
      /already have a project named/i,
    )
    await expect(createProject({ operatorId: 'operator-1', name: '  my brand  ' })).rejects.toThrow(
      /already have a project named/i,
    )
  })

  it('allows the same display name for different operators', async () => {
    const { createProject } = await import('../app/lib/server/projects')

    await createProject({ operatorId: 'operator-1', name: 'Shared Name' })
    await expect(
      createProject({ operatorId: 'operator-2', name: 'Shared Name' }),
    ).resolves.toMatchObject({ name: 'Shared Name' })
  })

  it('produces a unique slug when the same slug base is reused globally', async () => {
    const { createProject } = await import('../app/lib/server/projects')

    const first = await createProject({ operatorId: 'operator-1', name: 'default-project' })
    const second = await createProject({ operatorId: 'operator-2', name: 'default-project' })

    expect(first.slug).toBe('default-project')
    expect(second.slug).toBe('default-project-2')
  })

  it('lists only projects the operator belongs to', async () => {
    const { createProject, listOperatorProjects } = await import('../app/lib/server/projects')

    const own = await createProject({ operatorId: 'operator-1', name: 'Mine' })
    await createProject({ operatorId: 'operator-2', name: 'Theirs' })

    const visible = await listOperatorProjects('operator-1')
    expect(visible.map((p) => p.id)).toEqual([own.id])
  })

  it('refuses to set an active project the operator does not belong to', async () => {
    const { createProject, setActiveProject } = await import('../app/lib/server/projects')

    const project = await createProject({ operatorId: 'operator-1', name: 'Mine' })

    await expect(
      setActiveProject({ sessionId: 'session-1', operatorId: 'operator-2', projectId: project.id }),
    ).rejects.toThrow(/does not have access/)
  })

  it('sets the active project for the operator session', async () => {
    const { createProject, setActiveProject } = await import('../app/lib/server/projects')

    const project = await createProject({ operatorId: 'operator-1', name: 'Mine' })
    await setActiveProject({
      sessionId: 'session-1',
      operatorId: 'operator-1',
      projectId: project.id,
    })

    expect(sessions.get('session-1')).toEqual({
      id: 'session-1',
      active_project_id: project.id,
    })
  })

  it('pickActiveProjectId falls back to the first project when session has none', async () => {
    const { createProject, pickActiveProjectId, listOperatorProjects } = await import(
      '../app/lib/server/projects'
    )

    const first = await createProject({ operatorId: 'operator-1', name: 'First' })
    await createProject({ operatorId: 'operator-1', name: 'Second' })
    const projects = await listOperatorProjects('operator-1')

    expect(pickActiveProjectId(null, projects)).toBe(first.id)
  })

  it('requireActiveProjectId persists the fallback project on the session', async () => {
    const { createProject, requireActiveProjectId } = await import('../app/lib/server/projects')

    const project = await createProject({ operatorId: 'operator-1', name: 'Only' })

    await expect(
      requireActiveProjectId({
        sessionId: 'session-1',
        operatorId: 'operator-1',
        email: 'operator@example.com',
        firstName: null,
        onboardingStepCompleted: 0,
        onboardingDismissed: false,
        activeProjectId: null,
        isInstanceOwner: false,
      }),
    ).resolves.toBe(project.id)

    expect(sessions.get('session-1')).toEqual({
      id: 'session-1',
      active_project_id: project.id,
    })
  })

  it('returns the connected channel count for each operator project', async () => {
    const { createProject, listOperatorProjects } = await import('../app/lib/server/projects')

    const first = await createProject({ operatorId: 'operator-1', name: 'Brand A' })
    const second = await createProject({ operatorId: 'operator-1', name: 'Brand B' })

    // Newly-created projects start at zero.
    expect(first.connectedChannelCount).toBe(0)
    expect(second.connectedChannelCount).toBe(0)

    channelCounts.set(first.id, 2)
    channelCounts.set(second.id, 1)

    const refreshed = await listOperatorProjects('operator-1')
    const refreshedFirst = refreshed.find((p) => p.id === first.id)!
    const refreshedSecond = refreshed.find((p) => p.id === second.id)!
    expect(refreshedFirst.connectedChannelCount).toBe(2)
    expect(refreshedSecond.connectedChannelCount).toBe(1)
  })
})

describe('slugify', () => {
  it('lowercases, strips diacritics, and dasherizes', async () => {
    const { slugify } = await import('../app/lib/server/projects')
    expect(slugify('Café del Mar 2026!')).toBe('cafe-del-mar-2026')
  })

  it('falls back to "project" when input has no slug-safe characters', async () => {
    const { slugify } = await import('../app/lib/server/projects')
    expect(slugify('!!!')).toBe('project')
  })
})
