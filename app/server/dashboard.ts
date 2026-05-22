import { createServerFn } from '@tanstack/react-start'
import {
  accountStepInputSchema,
  importInputSchema,
  loginInputSchema,
  publishInputSchema,
} from '../lib/dashboard-schemas'
import { getDb, queryWithTimeout } from '../lib/db/client'
import { isDatabaseConnectionError } from '../lib/db/errors'
import { validateProviderPayload } from '../lib/domain/validation'
import { getProviderAdapter } from '../lib/providers'
import { getCodexCliStatus, type CodexCliStatus } from '../lib/server/codex-cli'
import { decryptSecret, hashPassword, verifyPassword } from '../lib/server/crypto'
import { isInstanceConfigured } from '../lib/server/instance-config'
import { logError, logInfo } from '../lib/server/logger'
import {
  listOperatorProjects,
  type OperatorProject,
} from '../lib/server/projects'
import {
  getProjectChannel,
  listPublicProjectChannels,
  type PublicProjectChannel,
} from '../lib/server/provider-accounts'
import {
  createOperatorSession,
  destroyCurrentSession,
  readOperatorSession,
  requireOperatorSession,
} from '../lib/server/session'
import {
  getAppSettings,
  getGenerationAiConfig,
  getPublicSettingsStatus,
} from '../lib/server/settings'

export const getBootstrapState = createServerFn({ method: 'GET' }).handler(async () => {
  const startedAt = Date.now()
  logInfo('bootstrap.start')
  let operatorCount

  try {
    operatorCount = await queryWithTimeout<{ count: string }>(
      'select count(*)::text as count from operators',
    )
    logInfo('bootstrap.operator_count_loaded', { durationMs: Date.now() - startedAt })
  } catch (caught) {
    if (caught instanceof Error && isDatabaseConnectionError(caught)) {
      logInfo('bootstrap.database_unavailable', { durationMs: Date.now() - startedAt })
      return {
        databaseAvailable: false,
        hasOperator: false,
        isAuthenticated: false,
        operatorEmail: undefined,
        operatorFirstName: undefined,
        onboardingStepCompleted: 0,
        onboardingDismissed: false,
        settings: null,
        codexCli: null,
        instanceConfigured: false,
        isInstanceOwner: false,
        activeProjectId: null,
        projects: [],
        connectedChannels: [],
      }
    }

    logError('bootstrap.failure', caught, { durationMs: Date.now() - startedAt })
    throw caught
  }

  const hasOperator = Number(operatorCount.rows[0]?.count ?? '0') > 0
  const session = hasOperator ? await readOperatorSession() : null
  logInfo('bootstrap.session_loaded', {
    durationMs: Date.now() - startedAt,
    hasOperator,
    isAuthenticated: Boolean(session),
  })

  const instanceConfigured = await isInstanceConfigured()

  let settings = null
  let projects: OperatorProject[] = []
  let connectedChannels: PublicProjectChannel[] = []
  let activeProjectId: string | null = null

  if (hasOperator && session) {
    projects = await listOperatorProjects(session.operatorId)
    activeProjectId = resolveActiveProjectId(session.activeProjectId, projects)
    connectedChannels = activeProjectId ? await listPublicProjectChannels(activeProjectId) : []
    logInfo('bootstrap.settings_loading', { durationMs: Date.now() - startedAt })
    settings = await getPublicSettingsStatus({
      checkCodexAuth: false,
      projectId: activeProjectId,
    })
    logInfo('bootstrap.settings_loaded', { durationMs: Date.now() - startedAt })
  }
  const codexCli: CodexCliStatus | null = null

  logInfo('bootstrap.success', {
    durationMs: Date.now() - startedAt,
    hasOperator,
    isAuthenticated: Boolean(session),
    hasCodexStatus: Boolean(codexCli),
    instanceConfigured,
    projectCount: projects.length,
  })

  return {
    databaseAvailable: true,
    hasOperator,
    isAuthenticated: Boolean(session),
    operatorEmail: session?.email,
    operatorFirstName: session?.firstName,
    onboardingStepCompleted: session?.onboardingStepCompleted ?? 0,
    onboardingDismissed: session?.onboardingDismissed ?? false,
    settings,
    codexCli,
    instanceConfigured,
    isInstanceOwner: session?.isInstanceOwner ?? false,
    activeProjectId,
    projects,
    connectedChannels,
  }
})

/**
 * Prefer the session's stored active project, but fall back to the operator's
 * first project so a fresh session after sign-up isn't blank. PR4 will set
 * `active_project_id` explicitly on project creation; this guard keeps the
 * bootstrap robust until then.
 */
function resolveActiveProjectId(
  sessionActiveProjectId: string | null,
  projects: OperatorProject[],
): string | null {
  if (sessionActiveProjectId && projects.some((project) => project.id === sessionActiveProjectId)) {
    return sessionActiveProjectId
  }
  return projects[0]?.id ?? null
}

export const saveAccountStep = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => accountStepInputSchema.parse(input))
  .handler(async ({ data }) => {
    const operatorCount = await getDb().query<{ count: string }>(
      'select count(*)::text as count from operators',
    )
    if (Number(operatorCount.rows[0]?.count ?? '0') > 0) {
      throw new Error('Onboarding is already complete.')
    }

    const passwordHash = await hashPassword(data.password)
    const operator = await getDb().query<{ id: string }>(
      `insert into operators
        (email, first_name, password_hash, onboarding_step_completed, is_instance_owner)
       values ($1, $2, $3, 1, true)
       returning id`,
      [data.email.toLowerCase(), data.firstName?.trim() || null, passwordHash],
    )

    await createOperatorSession(operator.rows[0]!.id)
    return {
      settings: await getPublicSettingsStatus(),
      onboardingStepCompleted: 1,
      codexCli: await getCodexCliStatus(),
    }
  })

export const advanceModelStep = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await requireOperatorSession()
  await getDb().query(
    `update operators
     set onboarding_step_completed = greatest(onboarding_step_completed, 2)
     where id = $1`,
    [session.operatorId],
  )
  return {
    settings: await getPublicSettingsStatus(),
    onboardingStepCompleted: 2,
  }
})

export const loginOperator = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => loginInputSchema.parse(input))
  .handler(async ({ data }) => {
    const operator = await getDb().query<{ id: string; password_hash: string }>(
      'select id, password_hash from operators where email = $1 limit 1',
      [data.email.toLowerCase()],
    )
    const row = operator.rows[0]
    const ok = row ? await verifyPassword(data.password, row.password_hash) : false
    if (!ok || !row) throw new Error('Invalid email or password.')

    await getDb().query('delete from operator_sessions where operator_id = $1', [row.id])
    await createOperatorSession(row.id)
    const settings = await getPublicSettingsStatus()
    const session = await readOperatorSession()
    return {
      settings,
      firstName: session?.firstName,
      onboardingStepCompleted: session?.onboardingStepCompleted ?? 0,
      onboardingDismissed: session?.onboardingDismissed ?? false,
      codexCli: await getCodexCliStatus(),
    }
  })

export const logoutOperator = createServerFn({ method: 'POST' }).handler(async () => {
  await destroyCurrentSession()
  return { ok: true }
})

export const dismissOnboardingWizard = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await requireOperatorSession()
  await getDb().query(
    `update operators
     set onboarding_dismissed_at = coalesce(onboarding_dismissed_at, now())
     where id = $1`,
    [session.operatorId],
  )
  return { onboardingDismissed: true }
})

export const importAndGenerate = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => importInputSchema.parse(input))
  .handler(async ({ data }) => {
    const startedAt = Date.now()
    try {
      await requireOperatorSession()
      logInfo('import_generate.start', {
        url: data.url,
        hasIntentPrompt: Boolean(data.intentPrompt?.trim()),
      })
      const settings = await getAppSettings()
      const generationConfig = getGenerationAiConfig(settings)
      logInfo('import_generate.settings_loaded', {
        activeAiBackendType: settings.activeAiBackendType,
        hasOpenAiKey: Boolean(settings.openaiApiKey),
        openaiModel: settings.openaiModel,
        codexCliModel: settings.codexCliModel,
      })
      const { importPublicBlogUrl } = await import('../lib/import/public-url')
      const source = await importPublicBlogUrl(data.url)
      logInfo('import_generate.source_imported', {
        canonicalUrl: source.canonicalUrl,
        hasImage: Boolean(source.imageUrl),
      })
      const { generateProviderVariants } = await import('../lib/ai/generate-variants')
      const variants = await generateProviderVariants(
        {
          source,
          intentPrompt: data.intentPrompt,
        },
        generationConfig ?? undefined,
      )
      logInfo('import_generate.success', {
        durationMs: Date.now() - startedAt,
        variantCount: variants.length,
      })

      return {
        source,
        variants: variants.map((variant) => ({
          ...variant,
          validation: validateProviderPayload(variant.provider, variant),
        })),
      }
    } catch (error) {
      logError('import_generate.failure', error, {
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  })

export const publishVariant = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    if (!session.activeProjectId) {
      throw new Error('Create a project before publishing.')
    }

    const channel = await getProjectChannel(session.activeProjectId, data.provider)
    if (!channel) {
      const label = data.provider === 'linkedin' ? 'LinkedIn' : 'X'
      throw new Error(
        `${label} is not connected for this project. Open the Connect Channels modal first.`,
      )
    }

    const adapter = getProviderAdapter(data.provider, {
      linkedinAuthorUrn: channel.authorUrn ?? undefined,
      linkedinApiVersion: undefined,
    })

    if (data.provider === 'linkedin' && !channel.authorUrn) {
      throw new Error('LinkedIn channel is missing the author URN. Reconnect LinkedIn.')
    }

    const token = decryptSecret(channel.accessTokenCiphertext)
    const result = await adapter.publish(data, token)
    return {
      providerPostId: result.providerPostId,
      providerPostUrl: result.providerPostUrl,
    }
  })

export type ImportResult = Awaited<ReturnType<typeof importAndGenerate>>
