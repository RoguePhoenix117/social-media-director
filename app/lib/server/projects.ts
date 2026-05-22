import { getDb } from '../db/client'
import type { OperatorSession } from './session'

export type Project = {
  id: string
  name: string
  slug: string
  channelsOnboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export type ProjectRole = 'owner'

export type OperatorProject = Project & {
  role: ProjectRole
  /**
   * Live count of OAuth-connected channels (rows in `provider_accounts`)
   * scoped to this project. Used by the project switcher badge in the app
   * layout and by Settings → Projects.
   */
  connectedChannelCount: number
}

type ProjectRow = {
  id: string
  name: string
  slug: string
  channels_onboarding_completed: boolean
  created_at: string
  updated_at: string
}

type OperatorProjectRow = ProjectRow & {
  role: string
  connected_channel_count: string | number | null
}

export async function createProject(input: {
  operatorId: string
  name: string
}): Promise<OperatorProject> {
  const name = input.name.trim()
  if (!name) throw new Error('Project name is required.')

  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('begin')
    if (await operatorHasProjectName(client, input.operatorId, name)) {
      throw new Error(`You already have a project named "${name}".`)
    }
    const slug = await reserveUniqueSlug(client, name)
    const projectResult = await client.query<ProjectRow>(
      `insert into projects (name, slug)
       values ($1, $2)
       returning id, name, slug, channels_onboarding_completed, created_at, updated_at`,
      [name, slug],
    )
    const project = projectResult.rows[0]
    if (!project) throw new Error('Failed to create project.')

    await client.query(
      `insert into operator_projects (operator_id, project_id, role)
       values ($1, $2, 'owner')`,
      [input.operatorId, project.id],
    )

    await client.query('commit')
    return mapOperatorProjectRow({
      ...project,
      role: 'owner',
      connected_channel_count: 0,
    })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listOperatorProjects(operatorId: string): Promise<OperatorProject[]> {
  const result = await getDb().query<OperatorProjectRow>(
    `select
       projects.id,
       projects.name,
       projects.slug,
       projects.channels_onboarding_completed,
       projects.created_at,
       projects.updated_at,
       operator_projects.role,
       coalesce(channel_counts.count, 0) as connected_channel_count
     from projects
     join operator_projects on operator_projects.project_id = projects.id
     left join (
       select project_id, count(*)::int as count
       from provider_accounts
       where project_id is not null
       group by project_id
     ) as channel_counts on channel_counts.project_id = projects.id
     where operator_projects.operator_id = $1
     order by projects.created_at asc`,
    [operatorId],
  )
  return result.rows.map(mapOperatorProjectRow)
}

/**
 * Picks the active project id from the session, falling back to the operator's
 * first project. Matches bootstrap behaviour so the UI and OAuth flows agree.
 */
export function pickActiveProjectId(
  sessionActiveProjectId: string | null,
  projects: OperatorProject[],
): string | null {
  if (
    sessionActiveProjectId &&
    projects.some((project) => project.id === sessionActiveProjectId)
  ) {
    return sessionActiveProjectId
  }
  return projects[0]?.id ?? null
}

/**
 * Resolves (and persists) the operator's active project for server actions that
 * require a project context — e.g. OAuth channel connection after re-login.
 */
export async function requireActiveProjectId(session: OperatorSession): Promise<string> {
  const projects = await listOperatorProjects(session.operatorId)
  const projectId = pickActiveProjectId(session.activeProjectId, projects)
  if (!projectId) {
    throw new Error('Create a project before connecting channels.')
  }

  if (projectId !== session.activeProjectId) {
    await setActiveProject({
      sessionId: session.sessionId,
      operatorId: session.operatorId,
      projectId,
    })
  }

  return projectId
}

export async function getProject(projectId: string): Promise<Project | null> {
  const result = await getDb().query<ProjectRow>(
    `select id, name, slug, channels_onboarding_completed, created_at, updated_at
     from projects
     where id = $1
     limit 1`,
    [projectId],
  )
  const row = result.rows[0]
  return row ? mapProjectRow(row) : null
}

export async function setActiveProject(input: {
  sessionId: string
  operatorId: string
  projectId: string | null
}): Promise<void> {
  if (input.projectId) {
    await ensureOperatorProjectAccess(input.operatorId, input.projectId)
  }
  await getDb().query(
    `update operator_sessions
     set active_project_id = $2
     where id = $1`,
    [input.sessionId, input.projectId],
  )
}

export async function ensureOperatorProjectAccess(operatorId: string, projectId: string) {
  const result = await getDb().query<{ exists: boolean }>(
    `select true as exists
     from operator_projects
     where operator_id = $1 and project_id = $2
     limit 1`,
    [operatorId, projectId],
  )
  if (!result.rows[0]?.exists) {
    throw new Error('Operator does not have access to this project.')
  }
}

/**
 * Lowercase, dash-separated, ASCII-safe. Empty input becomes `project`.
 * Caller is responsible for ensuring uniqueness — use {@link reserveUniqueSlug}.
 */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
  return slug || 'project'
}

type SlugQueryClient = {
  query: <T extends { slug: string }>(
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: T[] }>
}

type NameQueryClient = {
  query: <T extends { exists?: boolean }>(
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: T[] }>
}

async function operatorHasProjectName(
  client: NameQueryClient,
  operatorId: string,
  name: string,
) {
  const result = await client.query<{ exists: boolean }>(
    `select true as exists
     from projects p
     inner join operator_projects op on op.project_id = p.id
     where op.operator_id = $1
       and lower(trim(p.name)) = lower(trim($2))
     limit 1`,
    [operatorId, name],
  )
  return Boolean(result.rows[0]?.exists)
}

async function reserveUniqueSlug(client: SlugQueryClient, name: string) {
  const base = slugify(name)
  const result = await client.query<{ slug: string }>(
    `select slug from projects where slug = $1 or slug like $2`,
    [base, `${base}-%`],
  )
  const taken = new Set(result.rows.map((row) => row.slug))
  if (!taken.has(base)) return base

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
  throw new Error('Unable to allocate unique project slug.')
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    channelsOnboardingCompleted: row.channels_onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOperatorProjectRow(row: OperatorProjectRow): OperatorProject {
  return {
    ...mapProjectRow(row),
    role: row.role === 'owner' ? 'owner' : 'owner',
    connectedChannelCount: Number(row.connected_channel_count ?? 0),
  }
}
