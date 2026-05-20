import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import {
  BookOpen,
  Bot,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  KeyRound,
  Link2,
  ListChecks,
  PenLine,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X as XIcon,
} from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { AppLayout } from '../components/app-layout'
import { PlatformIcon } from '../components/platform-icons'
import { generateProviderVariants } from '../lib/ai/generate-variants'
import { bootstrapQueryKey } from '../lib/bootstrap-query'
import { getDb } from '../lib/db/client'
import { isDatabaseConnectionError } from '../lib/db/errors'
import type { ProviderVariant } from '../lib/domain/providers'
import { validateProviderPayload } from '../lib/domain/validation'
import { importPublicBlogUrl } from '../lib/import/public-url'
import { getProviderAdapter } from '../lib/providers'
import { hashPassword, verifyPassword } from '../lib/server/crypto'
import { logError, logInfo } from '../lib/server/logger'
import {
  createOperatorSession,
  destroyCurrentSession,
  readOperatorSession,
  requireOperatorSession,
} from '../lib/server/session'
import {
  getAppSettings,
  getPublicSettingsStatus,
  saveAppSettings,
  type PublicSettingsStatus,
} from '../lib/server/settings'

const importInputSchema = z.object({
  url: z.string().url(),
  intentPrompt: z.string().optional(),
})
const importFormSchema = importInputSchema.extend({
  intentPrompt: z.string(),
})

const loginInputSchema = z.object({
  email: z.string().email('Enter the email for your operator account.'),
  password: z.string().min(1, 'Enter your password.'),
})

const accountStepInputSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(12, 'Use at least 12 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
  firstName: z.string().optional(),
})
const accountStepFormSchema = accountStepInputSchema.extend({
  firstName: z.string(),
})

const modelStepInputSchema = z.object({
  aiProvider: z.enum(['openaiApiKey', 'codexCli']).optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().min(1).default('gpt-4.1-mini'),
  codexCliModel: z.string().optional(),
})
const modelStepFormSchema = modelStepInputSchema.extend({
  aiProvider: z.enum(['openaiApiKey', 'codexCli']),
  openaiApiKey: z.string(),
  openaiModel: z.string().min(1),
  codexCliModel: z.string(),
})

const socialStepInputSchema = z.object({
  xAccessToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})
const socialStepFormSchema = z.object({
  xAccessToken: z.string(),
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string(),
})

const settingsInputSchema = z.object({
  aiProvider: z.enum(['openaiApiKey', 'codexCli']).optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  codexCliModel: z.string().optional(),
  xAccessToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})
const settingsFormSchema = z.object({
  aiProvider: z.enum(['openaiApiKey', 'codexCli']),
  openaiApiKey: z.string(),
  openaiModel: z.string(),
  codexCliModel: z.string(),
  xAccessToken: z.string(),
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string(),
})

const publishInputSchema = z.object({
  provider: z.enum(['x', 'linkedin']),
  text: z.string().min(1),
  linkUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
})

const getBootstrapState = createServerFn({ method: 'GET' }).handler(async () => {
  let operatorCount

  try {
    operatorCount = await getDb().query<{ count: string }>(
      'select count(*)::text as count from operators',
    )
  } catch (caught) {
    if (caught instanceof Error && isDatabaseConnectionError(caught)) {
      return {
        databaseAvailable: false,
        hasOperator: false,
        isAuthenticated: false,
        operatorEmail: undefined,
        operatorFirstName: undefined,
        onboardingStepCompleted: 0,
        settings: null,
      }
    }

    throw caught
  }

  const hasOperator = Number(operatorCount.rows[0]?.count ?? '0') > 0
  const session = hasOperator ? await readOperatorSession() : null
  const settings = hasOperator && session ? await getPublicSettingsStatus() : null

  return {
    databaseAvailable: true,
    hasOperator,
    isAuthenticated: Boolean(session),
    operatorEmail: session?.email,
    operatorFirstName: session?.firstName,
    onboardingStepCompleted: session?.onboardingStepCompleted ?? 0,
    settings,
  }
})

function bootstrapQueryOptions() {
  return queryOptions({
    queryKey: bootstrapQueryKey,
    queryFn: () => getBootstrapState(),
    staleTime: 30_000,
  })
}

const saveAccountStep = createServerFn({ method: 'POST' })
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
        (email, first_name, password_hash, onboarding_step_completed)
       values ($1, $2, $3, 1)
       returning id`,
      [data.email.toLowerCase(), data.firstName?.trim() || null, passwordHash],
    )

    await createOperatorSession(operator.rows[0]!.id)
    return {
      settings: await getPublicSettingsStatus(),
      onboardingStepCompleted: 1,
    }
  })

const saveModelStep = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => modelStepInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    await saveAppSettings({
      aiProvider: data.aiProvider ?? 'openaiApiKey',
      openaiApiKey: data.openaiApiKey,
      openaiModel: data.openaiModel,
      codexCliModel: data.codexCliModel,
    })
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

const saveSocialStep = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => socialStepInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireOperatorSession()
    await saveAppSettings({
      xAccessToken: data.xAccessToken,
      linkedinAccessToken: data.linkedinAccessToken,
      linkedinAuthorUrn: data.linkedinAuthorUrn,
      linkedinApiVersion: data.linkedinApiVersion || '202604',
    })
    await getDb().query(
      `update operators
       set onboarding_step_completed = 3,
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
       where id = $1`,
      [session.operatorId],
    )
    return {
      settings: await getPublicSettingsStatus(),
      onboardingStepCompleted: 3,
    }
  })

const loginOperator = createServerFn({ method: 'POST' })
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
    }
  })

const logoutOperator = createServerFn({ method: 'POST' }).handler(async () => {
  await destroyCurrentSession()
  return { ok: true }
})

const saveSettings = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => settingsInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    await saveAppSettings(data)
    return getPublicSettingsStatus()
  })

const importAndGenerate = createServerFn({ method: 'POST' })
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
      logInfo('import_generate.settings_loaded', {
        aiProvider: settings.aiProvider ?? 'openaiApiKey',
        hasOpenAiKey: Boolean(settings.openaiApiKey),
        openaiModel: settings.openaiModel,
        codexCliModel: settings.codexCliModel,
      })
      const source = await importPublicBlogUrl(data.url)
      logInfo('import_generate.source_imported', {
        canonicalUrl: source.canonicalUrl,
        hasImage: Boolean(source.imageUrl),
      })
      const variants = await generateProviderVariants(
        {
          source,
          intentPrompt: data.intentPrompt,
        },
        {
          aiProvider: settings.aiProvider,
          openaiApiKey: settings.openaiApiKey,
          openaiModel: settings.openaiModel,
          codexCliModel: settings.codexCliModel,
        },
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

const publishVariant = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    const settings = await getAppSettings()
    const adapter = getProviderAdapter(data.provider, {
      linkedinAuthorUrn: settings.linkedinAuthorUrn,
      linkedinApiVersion: settings.linkedinApiVersion,
    })
    const token = data.provider === 'x' ? settings.xAccessToken : settings.linkedinAccessToken

    if (!token) {
      throw new Error(`${data.provider === 'x' ? 'X' : 'LinkedIn'} credentials are not configured.`)
    }

    if (data.provider === 'linkedin' && !settings.linkedinAuthorUrn) {
      throw new Error('LinkedIn author URN is not configured.')
    }

    const result = await adapter.publish(data, token)
    return {
      providerPostId: result.providerPostId,
      providerPostUrl: result.providerPostUrl,
    }
  })

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(bootstrapQueryOptions()),
  component: Dashboard,
  errorComponent: DashboardError,
})

type BootstrapState = Awaited<ReturnType<typeof getBootstrapState>>
type ImportResult = Awaited<ReturnType<typeof importAndGenerate>>

const linkedinGuideSteps = [
  {
    title: 'Pick: personal profile or company Page',
    summary:
      'Start by deciding where posts should appear. A personal profile is the easiest path. A company Page usually needs extra LinkedIn product approval and the signed-in LinkedIn member must be an admin of that Page.',
    checklist: [
      'Individual creator: choose personal profile posting and plan to use an author URN like urn:li:person:abc123.',
      'Company operator: choose company Page posting and confirm your LinkedIn account manages that Page.',
      'If you only need to post to your own profile, you usually only need the Share on LinkedIn product and w_member_social permission.',
    ],
    links: [
      ['LinkedIn API access overview', 'https://learn.microsoft.com/linkedin/shared/authentication/getting-access?context=linkedin%2Fcontext'],
      ['Share on LinkedIn product', 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin'],
    ],
  },
  {
    title: 'Create the LinkedIn app',
    summary:
      'Open LinkedIn Developers, create an app, and fill in the required app details. Treat this like registering this dashboard as a tool that is allowed to ask LinkedIn for posting permission.',
    checklist: [
      'Go to the LinkedIn Developer Portal and create a new app from My Apps.',
      'Enter an app name, connect it to your LinkedIn Page if LinkedIn asks, and add a logo/privacy policy if required.',
      'After the app exists, open its Products tab. This is where you request the features your app is allowed to use.',
    ],
    links: [
      ['LinkedIn Developer Portal', 'https://www.linkedin.com/developers/apps'],
      ['Getting access to LinkedIn APIs', 'https://learn.microsoft.com/linkedin/shared/authentication/getting-access?context=linkedin%2Fcontext'],
    ],
  },
  {
    title: 'Add the right products and permissions',
    summary:
      'For personal profile posting, add Share on LinkedIn. For company Page posting or marketing/community management workflows, you may need to apply for Marketing API access and wait for approval.',
    checklist: [
      'Personal profile posts: add Share on LinkedIn and request w_member_social during OAuth.',
      'Sign-in/profile lookup: add Sign in with LinkedIn using OpenID Connect and request openid, profile, and/or email.',
      'Company Page posts: review Marketing/Community Management access. Some organization permissions require approval.',
    ],
    links: [
      ['OpenID Connect sign-in', 'https://learn.microsoft.com/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2?context=linkedin%2Fconsumer%2Fcontext'],
      ['Marketing API program', 'https://learn.microsoft.com/en-us/linkedin/marketing/?view=li-lms-2026-04'],
    ],
  },
  {
    title: 'Create the token and paste values here',
    summary:
      'LinkedIn access tokens come from OAuth. The LinkedIn member signs in, approves the requested permissions, and your app receives a token. This dashboard stores that token encrypted in your local database.',
    checklist: [
      'Paste the access token into LinkedIn access token.',
      'Paste urn:li:person:... for individual posting or urn:li:organization:... for company posting into LinkedIn author URN.',
      'Leave API version at 202604 unless LinkedIn tells you to use a newer REST API version.',
    ],
    links: [
      ['LinkedIn OAuth 2.0 authentication', 'https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication'],
      ['LinkedIn API versioning', 'https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-04'],
    ],
  },
] as const

function DashboardError({ error }: ErrorComponentProps) {
  const router = useRouter()

  if (isDatabaseConnectionError(error)) {
    return <DatabaseSetupScreen onRetry={() => void router.invalidate()} />
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Dashboard error</p>
        <h1>Dashboard could not load</h1>
        <p className="setup-copy">{error.message}</p>
        <button onClick={() => void router.invalidate()} type="button">
          Retry
        </button>
      </section>
    </main>
  )
}

function DatabaseSetupScreen({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Database setup</p>
        <h1>Postgres is not reachable</h1>
        <p className="setup-copy">
          The app tried to connect to Postgres while loading the dashboard, but the
          database refused the connection. Start Postgres, check DATABASE_URL in
          your .env file, then apply the migrations from the README.
        </p>
        <div className="setup-commands" aria-label="Database setup commands">
          <code>psql "$DATABASE_URL" -f migrations/0001_initial.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0002_onboarding.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0003_stepwise_onboarding.sql</code>
        </div>
        <button onClick={onRetry} type="button">
          Retry connection
        </button>
      </section>
    </main>
  )
}

function getProviderLabel(provider: ProviderVariant['provider']) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}

function aiModelStatusValue(settings: PublicSettingsStatus | null) {
  if (!settings?.modelConfigured) return 'Missing'

  if (settings.aiProvider === 'codexCli') {
    return `Ready: Codex CLI / ${settings.codexCliModel ?? 'gpt-5.2'}`
  }

  return `Ready: OpenAI API / ${settings.openaiModel ?? 'gpt-4.1-mini'}`
}

function FieldErrors({ errors }: Readonly<{ errors: Array<unknown> }>) {
  if (!errors.length) return null

  return (
    <ul className="field-errors">
      {errors.map((error, index) => (
        <li key={index}>{formatFieldError(error)}</li>
      ))}
    </ul>
  )
}

function formatFieldError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message
    if (typeof message === 'string') return message
  }
  return 'Invalid value.'
}

function Dashboard() {
  const bootstrap = Route.useLoaderData()
  const queryClient = useQueryClient()
  const { data: authState, refetch: refetchBootstrap } = useQuery({
    ...bootstrapQueryOptions(),
    initialData: bootstrap,
  })
  const importAndGenerateFn = useServerFn(importAndGenerate)
  const publishVariantFn = useServerFn(publishVariant)
  const saveAccountStepFn = useServerFn(saveAccountStep)
  const saveModelStepFn = useServerFn(saveModelStep)
  const saveSocialStepFn = useServerFn(saveSocialStep)
  const loginOperatorFn = useServerFn(loginOperator)
  const logoutOperatorFn = useServerFn(logoutOperator)
  const saveSettingsFn = useServerFn(saveSettings)

  const [result, setResult] = useState<ImportResult | undefined>()
  const [variants, setVariants] = useState<ProviderVariant[]>([])
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string>()
  const [publishState, setPublishState] = useState<Record<string, string>>({})
  function updateBootstrapState(nextState: BootstrapState | ((current: BootstrapState) => BootstrapState)) {
    queryClient.setQueryData<BootstrapState>(bootstrapQueryKey, (current) => {
      const existing = current ?? authState
      return typeof nextState === 'function' ? nextState(existing) : nextState
    })
  }

  const displayName = authState.operatorFirstName
    ? authState.operatorFirstName
    : authState.operatorEmail ?? 'Signed in'
  const importForm = useForm({
    defaultValues: {
      url: '',
      intentPrompt: '',
    },
    validators: {
      onChange: importFormSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      setError(undefined)
      setGenerationStatus('Importing the source URL...')

      try {
        const providerLabel = authState.settings?.aiProvider === 'codexCli'
          ? 'Codex CLI'
          : authState.settings?.modelConfigured
            ? 'OpenAI API'
            : 'fallback templates'
        setGenerationStatus(`Generating drafts with ${providerLabel}. This can take a minute.`)
        const nextResult = await importAndGenerateFn({
          data: { url: value.url, intentPrompt: value.intentPrompt || undefined },
        })
        setResult(nextResult)
        setVariants(nextResult.variants)
        setGenerationStatus(`Generated ${nextResult.variants.length} platform drafts.`)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Import failed.'
        setError(message)
        setGenerationStatus(`Generation failed: ${message}`)
      } finally {
        setIsLoading(false)
      }
    },
  })

  if (!authState.databaseAvailable) {
    return <DatabaseSetupScreen onRetry={() => void refetchBootstrap()} />
  }

  if (!authState.hasOperator) {
    return (
      <OnboardingWizard
        mode="first-run"
        onboardingStepCompleted={0}
        settings={null}
        onAccountSave={async (data) => {
          const result = await saveAccountStepFn({ data })
          updateBootstrapState({
            databaseAvailable: true,
            hasOperator: true,
            isAuthenticated: true,
            operatorEmail: data.email.toLowerCase(),
            operatorFirstName: data.firstName ? data.firstName : null,
            onboardingStepCompleted: result.onboardingStepCompleted,
            settings: result.settings,
          })
        }}
        onModelSave={async (data) => {
          const result = await saveModelStepFn({ data })
          updateBootstrapState((current) => {
            if (!current.databaseAvailable) return current
            return {
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: result.settings,
            }
          })
        }}
        onSocialSave={async (data) => {
          const result = await saveSocialStepFn({ data })
          updateBootstrapState((current) => {
            if (!current.databaseAvailable) return current
            return {
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: result.settings,
            }
          })
        }}
      />
    )
  }

  if (!authState.isAuthenticated) {
    return (
      <LoginScreen
        onSubmit={async (data) => {
          const result = await loginOperatorFn({ data })
          updateBootstrapState({
            databaseAvailable: true,
            hasOperator: true,
            isAuthenticated: true,
            operatorEmail: data.email.toLowerCase(),
            operatorFirstName: result.firstName,
            onboardingStepCompleted: result.onboardingStepCompleted,
            settings: result.settings,
          })
        }}
      />
    )
  }

  async function onPublish(variant: ProviderVariant) {
    setPublishState((current) => ({
      ...current,
      [variant.provider]: 'Publishing...',
    }))

    try {
      const publishResult = await publishVariantFn({
        data: {
          provider: variant.provider,
          text: variant.text,
          linkUrl: variant.linkUrl,
          imageUrl: variant.imageUrl,
        },
      })
      setPublishState((current) => ({
        ...current,
        [variant.provider]: publishResult.providerPostUrl
          ? `Published: ${publishResult.providerPostUrl}`
          : `Published: ${publishResult.providerPostId}`,
      }))
    } catch (caught) {
      setPublishState((current) => ({
        ...current,
        [variant.provider]: caught instanceof Error ? caught.message : 'Publish failed.',
      }))
    }
  }

  async function onLogout() {
    await logoutOperatorFn()
    updateBootstrapState({
      databaseAvailable: true,
      hasOperator: true,
      isAuthenticated: false,
      operatorEmail: undefined,
      operatorFirstName: undefined,
      onboardingStepCompleted: 0,
      settings: null,
    })
  }

  const statusCards = [
    {
      label: 'AI model',
      value: aiModelStatusValue(authState.settings),
      isReady: Boolean(authState.settings?.modelConfigured),
      icon: Bot,
      action: {
        label: 'AI settings',
        to: '/settings',
        hash: 'ai-workspace',
      },
    },
    {
      label: 'X publishing',
      value: authState.settings?.xConfigured ? 'Connected' : 'Not connected',
      isReady: Boolean(authState.settings?.xConfigured),
      icon: Send,
    },
    {
      label: 'LinkedIn',
      value: authState.settings?.linkedinConfigured ? 'Connected' : 'Not connected',
      isReady: Boolean(authState.settings?.linkedinConfigured),
      icon: Link2,
    },
    {
      label: 'Drafts generated',
      value: variants.length ? String(variants.length) : '0',
      isReady: variants.length > 0,
      icon: PenLine,
    },
  ]

  return (
    <AppLayout
      onLogout={() => void onLogout()}
      operatorName={authState.operatorFirstName ? authState.operatorFirstName : authState.operatorEmail ?? 'Signed in'}
    >
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP V1</p>
            <h1>Welcome to your Dashboard, {displayName}</h1>
            <p className="page-summary">
              Import a public post, shape it with AI, and publish channel-ready drafts from
              one self-hosted dashboard.
            </p>
          </div>
          <div className="header-action">
            <KeyRound aria-hidden="true" size={18} />
            Local encrypted credentials
          </div>
        </header>

        <section className="stats-grid" aria-label="Integration status">
          {statusCards.map((card) => {
            const action = 'action' in card ? card.action : undefined

            return (
              <article className="stat-card" key={card.label}>
                <div className={card.isReady ? 'stat-icon ready' : 'stat-icon'}>
                  <card.icon aria-hidden="true" size={22} />
                </div>
                <div>
                  <p>{card.label}</p>
                  <strong className={card.isReady ? 'status-value ready' : 'status-value'}>
                    {card.value}
                  </strong>
                </div>
                {action ? (
                  <Link
                    aria-label="Open AI model settings"
                    className="stat-card-action"
                    hash={action.hash}
                    to={action.to}
                  >
                    <SlidersHorizontal aria-hidden="true" size={16} />
                    <span>{action.label}</span>
                  </Link>
                ) : null}
              </article>
            )
          })}
        </section>

      {authState.onboardingStepCompleted < 3 ? (
        <OnboardingWizard
          mode="resume"
          onboardingStepCompleted={authState.onboardingStepCompleted}
          settings={authState.settings}
          onModelSave={async (data) => {
            const result = await saveModelStepFn({ data })
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return {
                ...current,
                onboardingStepCompleted: result.onboardingStepCompleted,
                settings: result.settings,
              }
            })
          }}
          onSocialSave={async (data) => {
            const result = await saveSocialStepFn({ data })
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return {
                ...current,
                onboardingStepCompleted: result.onboardingStepCompleted,
                settings: result.settings,
              }
            })
          }}
        />
      ) : null}

      <SettingsPanel
        settings={authState.settings}
        onSave={async (data) => {
          const settings = await saveSettingsFn({ data })
          updateBootstrapState((current) => {
            if (!current.databaseAvailable) return current
            return { ...current, settings }
          })
        }}
      />

      <section className="workspace" id="workspace">
        <form
          className="import-panel"
          onSubmit={(event) => {
            event.preventDefault()
            void importForm.handleSubmit()
          }}
        >
          <div className="panel-heading">
            <Sparkles aria-hidden="true" size={22} />
            <div>
              <h2>AI Content Assistant</h2>
              <p>Paste a source URL and add direction for the generated drafts.</p>
            </div>
          </div>
          <importForm.Field name="url">
            {(field) => (
              <label>
                Blog post URL
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://example.com/blog/product-update"
                  required
                  type="url"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </importForm.Field>
          <importForm.Field name="intentPrompt">
            {(field) => (
              <label>
                Optional direction
                <textarea
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Emphasize the launch angle and invite readers to try it."
                  rows={4}
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </importForm.Field>
          <button disabled={isLoading} type="submit">
            {isLoading ? 'Generating...' : 'Import and generate'}
          </button>
          {generationStatus ? <p className="generation-status">{generationStatus}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="source-panel">
          <div className="panel-heading">
            <FileText aria-hidden="true" size={22} />
            <div>
              <h2>Imported source</h2>
              <p>Preview of the content that will anchor the social drafts.</p>
            </div>
          </div>
          {result ? (
            <article>
              {result.source.imageUrl ? (
                <img alt="" className="source-image" src={result.source.imageUrl} />
              ) : null}
              <h3>{result.source.title}</h3>
              <p>{result.source.excerpt}</p>
              <a href={result.source.canonicalUrl}>{result.source.canonicalUrl}</a>
            </article>
          ) : (
            <p className="empty">Import a public blog post to generate social drafts.</p>
          )}
        </section>
      </section>

      <section className="variants" id="variants">
        {variants.map((variant, index) => {
          const validation = validateProviderPayload(variant.provider, variant)
          return (
            <article className="variant-card" key={variant.provider}>
              <div className="variant-header">
                <div className="provider-title">
                  <div className="platform-mark compact">
                    <PlatformIcon platform={variant.provider} size={18} />
                  </div>
                  <div>
                    <p className="eyebrow">Platform draft</p>
                    <h2>{getProviderLabel(variant.provider)}</h2>
                  </div>
                </div>
                <span className={validation.status}>
                  {validation.status === 'valid' ? (
                    <CheckCircle2 aria-hidden="true" size={15} />
                  ) : (
                    <CircleAlert aria-hidden="true" size={15} />
                  )}
                  {validation.status}
                </span>
              </div>
              <textarea
                value={variant.text}
                onChange={(event) => {
                  const next = [...variants]
                  next[index] = { ...variant, text: event.target.value }
                  setVariants(next)
                }}
                rows={variant.provider === 'x' ? 6 : 10}
              />
              <div className="variant-meta">
                <span>{variant.text.length} characters</span>
                {variant.linkUrl ? <span>{variant.linkUrl}</span> : null}
              </div>
              {validation.messages.length ? (
                <ul className="validation-list">
                  {validation.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
              <button
                disabled={validation.status === 'invalid'}
                onClick={() => void onPublish(variant)}
                type="button"
              >
                <Send aria-hidden="true" size={17} />
                Publish via official API
              </button>
              {publishState[variant.provider] ? (
                <p className="publish-state">{publishState[variant.provider]}</p>
              ) : null}
            </article>
          )
        })}
      </section>
    </AppLayout>
  )
}

function OnboardingWizard({
  mode,
  onboardingStepCompleted,
  settings,
  onAccountSave,
  onModelSave,
  onSocialSave,
}: {
  mode: 'first-run' | 'resume'
  onboardingStepCompleted: number
  settings: PublicSettingsStatus | null
  onAccountSave?: (data: z.infer<typeof accountStepInputSchema>) => Promise<void>
  onModelSave: (data: z.infer<typeof modelStepInputSchema>) => Promise<void>
  onSocialSave: (data: z.infer<typeof socialStepInputSchema>) => Promise<void>
}) {
  const initialStep =
    mode === 'first-run'
      ? Math.min(onboardingStepCompleted + 1, 3)
      : Math.max(2, Math.min(onboardingStepCompleted + 1, 3))
  const [step, setStep] = useState(initialStep)
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const accountForm = useForm({
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
    },
    validators: {
      onChange: accountStepFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        if (!onAccountSave) throw new Error('Account setup is already complete.')
        await onAccountSave(value)
        setMessage('Account saved. You can continue setup now or come back later.')
        setStep(2)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Account setup failed.')
      }
    },
  })
  const modelForm = useForm({
    defaultValues: {
      aiProvider: settings?.aiProvider === 'codexCli' ? 'codexCli' : 'openaiApiKey',
      openaiApiKey: '',
      openaiModel: settings?.openaiModel ?? 'gpt-4.1-mini',
      codexCliModel: settings?.codexCliModel ?? 'gpt-5.2',
    },
    validators: {
      onChange: modelStepFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        await onModelSave({
          aiProvider: value.aiProvider as 'openaiApiKey' | 'codexCli',
          openaiApiKey: value.openaiApiKey || undefined,
          openaiModel: value.openaiModel,
          codexCliModel: value.codexCliModel,
        })
        setMessage('Model settings saved. You can continue or come back later.')
        setStep(3)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Model setup failed.')
      }
    },
  })
  const socialForm = useForm({
    defaultValues: {
      xAccessToken: '',
      linkedinAccessToken: '',
      linkedinAuthorUrn: '',
      linkedinApiVersion: settings?.linkedinApiVersion ?? '202604',
    },
    validators: {
      onChange: socialStepFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        await onSocialSave({
          xAccessToken: value.xAccessToken || undefined,
          linkedinAccessToken: value.linkedinAccessToken || undefined,
          linkedinAuthorUrn: value.linkedinAuthorUrn || undefined,
          linkedinApiVersion: value.linkedinApiVersion,
        })
        setMessage('Social integrations saved. Onboarding is complete.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Social setup failed.')
      }
    },
  })

  const shellClass = mode === 'first-run' ? 'auth-shell' : 'wizard-shell'
  const panelClass = mode === 'first-run' ? 'auth-panel onboarding-panel' : 'wizard-panel'

  async function skipModelStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onModelSave({
        aiProvider: modelForm.state.values.aiProvider as 'openaiApiKey' | 'codexCli',
        openaiModel: modelForm.state.values.openaiModel,
        codexCliModel: modelForm.state.values.codexCliModel,
      })
      setMessage('Model step skipped. You can add an API key later in settings.')
      setStep(3)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Model setup failed.')
    }
  }

  async function skipSocialStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onSocialSave({ linkedinApiVersion: socialForm.state.values.linkedinApiVersion })
      setMessage('Social step skipped. Onboarding is complete.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Social setup failed.')
    }
  }

  return (
    <main className={shellClass}>
      <section className={panelClass}>
        <p className="eyebrow">{mode === 'first-run' ? 'First run' : 'Finish setup'}</p>
        <h1>{mode === 'first-run' ? 'Set up Social Media Director' : 'Continue onboarding'}</h1>
        <div className="stepper" aria-label="Onboarding progress">
          <span className={step === 1 ? 'active' : onboardingStepCompleted >= 1 ? 'done' : ''}>
            1 Account
          </span>
          <span className={step === 2 ? 'active' : onboardingStepCompleted >= 2 ? 'done' : ''}>
            2 Model
          </span>
          <span className={step === 3 ? 'active' : onboardingStepCompleted >= 3 ? 'done' : ''}>
            3 Social
          </span>
        </div>

        {step === 1 && mode === 'first-run' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void accountForm.handleSubmit()
            }}
          >
            <p className="setup-copy">
              Create the local operator account for this self-hosted install. This login is
              only for your dashboard and is separate from OpenAI, X, or LinkedIn.
            </p>
            <div className="form-grid">
              <accountForm.Field name="email">
                {(field) => (
                  <label>
                    Operator email
                    <input
                      autoComplete="username"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={field.state.value}
                    />
                    <small className="field-guidance">Use the email you want for dashboard login and recovery context.</small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </accountForm.Field>
              <accountForm.Field name="password">
                {(field) => (
                  <label>
                    Password
                    <input
                      autoComplete="new-password"
                      minLength={12}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      required
                      type="password"
                      value={field.state.value}
                    />
                    <small className="field-guidance">Use 12+ characters with at least one letter and one number.</small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </accountForm.Field>
              <accountForm.Field name="firstName">
                {(field) => (
                  <label>
                    First name <span className="optional-label">Optional</span>
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </accountForm.Field>
            </div>
            <button type="submit">Save account</button>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void modelForm.handleSubmit()
            }}
          >
            <p className="setup-copy">
              Optional: add an OpenAI API key if you want generated social copy. Create or
              copy a key from{' '}
              <a href="https://platform.openai.com/api-keys">OpenAI API keys</a>. The key
              is stored encrypted in your local Postgres database. Leave it blank to write
              posts manually.
            </p>
            <div className="form-grid">
              <modelForm.Field name="aiProvider">
                {(field) => (
                  <label>
                    AI backend
                    <select
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value as 'openaiApiKey' | 'codexCli')
                      }
                      value={field.state.value}
                    >
                      <option value="openaiApiKey">OpenAI API key</option>
                      <option value="codexCli">Local Codex CLI</option>
                    </select>
                    <small className="field-guidance">
                      Codex CLI mode uses your locally authenticated codex command.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </modelForm.Field>
              <modelForm.Field name="openaiApiKey">
                {(field) => (
                  <label>
                    OpenAI API key
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={settings?.modelConfigured ? 'Configured' : 'Optional'}
                      type="password"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </modelForm.Field>
              <modelForm.Field name="openaiModel">
                {(field) => (
                  <label>
                    Model
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </modelForm.Field>
              <modelForm.Field name="codexCliModel">
                {(field) => (
                  <label>
                    Codex CLI model
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                    <small className="field-guidance">
                      Used only when Local Codex CLI is selected.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </modelForm.Field>
            </div>
            <div className="button-row">
              <button type="submit">Save model step</button>
              <button
                className="secondary-button"
                onClick={() => void skipModelStep()}
                type="button"
              >
                Skip for now
              </button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void socialForm.handleSubmit()
            }}
          >
            <p className="setup-copy">
              Optional: add provider credentials for direct API publishing. For X, create
              an app in the <a href="https://developer.x.com/">X Developer Portal</a> and
              generate a user access token with post/write access. For LinkedIn, create an
              app at <a href="https://www.linkedin.com/developers/">LinkedIn Developers</a>,
              request the posting product/scopes you need, then use a member or
              organization author URN such as urn:li:person:... or urn:li:organization:....
            </p>
            <LinkedInApiGuide />
            <div className="form-grid">
              <socialForm.Field name="xAccessToken">
                {(field) => (
                  <label>
                    X access token
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={settings?.xConfigured ? 'Configured' : 'Optional'}
                      type="password"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </socialForm.Field>
              <socialForm.Field name="linkedinAccessToken">
                {(field) => (
                  <label>
                    LinkedIn access token
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={settings?.linkedinConfigured ? 'Configured' : 'Optional'}
                      type="password"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </socialForm.Field>
              <socialForm.Field name="linkedinAuthorUrn">
                {(field) => (
                  <label>
                    LinkedIn author URN
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="urn:li:person:..."
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </socialForm.Field>
              <socialForm.Field name="linkedinApiVersion">
                {(field) => (
                  <label>
                    LinkedIn API version
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </socialForm.Field>
            </div>
            <div className="button-row">
              <button type="submit">Save social step</button>
              <button
                className="secondary-button"
                onClick={() => void skipSocialStep()}
                type="button"
              >
                Skip and finish
              </button>
            </div>
          </form>
        ) : null}

        {message ? <p className="publish-state">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  )
}

function LinkedInApiGuide({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const step = linkedinGuideSteps[stepIndex]
  const isLastStep = stepIndex === linkedinGuideSteps.length - 1

  function openGuide() {
    setStepIndex(0)
    setIsOpen(true)
  }

  function closeGuide() {
    setIsOpen(false)
  }

  return (
    <>
      {compact ? (
        <button className="secondary-button" onClick={openGuide} type="button">
          <BookOpen aria-hidden="true" size={17} />
          LinkedIn guide
        </button>
      ) : (
        <aside className="linkedin-guide-card">
          <div className="panel-heading">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <h2>LinkedIn API access guide</h2>
              <p>
                Walk through app products, OAuth scopes, access tokens, and author URNs
                before saving credentials.
              </p>
            </div>
          </div>
          <div className="guide-actions">
            <button onClick={openGuide} type="button">
              <BookOpen aria-hidden="true" size={17} />
              Start tutorial
            </button>
            <a
              className="secondary-link"
              href="https://learn.microsoft.com/en-us/linkedin/"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={16} />
              Microsoft Learn
            </a>
          </div>
        </aside>
      )}

      {isOpen ? (
        <div aria-labelledby="linkedin-guide-title" aria-modal="true" className="modal-backdrop" role="dialog">
          <section className="guide-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  LinkedIn tutorial {stepIndex + 1} of {linkedinGuideSteps.length}
                </p>
                <h2 id="linkedin-guide-title">{step.title}</h2>
              </div>
              <button aria-label="Close LinkedIn tutorial" className="icon-button" onClick={closeGuide} type="button">
                <XIcon aria-hidden="true" size={18} />
              </button>
            </div>
            <p className="setup-copy">{step.summary}</p>
            <ul className="guide-checklist">
              {step.checklist.map((item) => (
                <li key={item}>
                  <ListChecks aria-hidden="true" size={17} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="guide-link-list">
              {step.links.map(([label, href]) => (
                <a href={href} key={href} rel="noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" size={15} />
                  {label}
                </a>
              ))}
            </div>
            <div className="guide-progress" aria-hidden="true">
              {linkedinGuideSteps.map((guideStep, index) => (
                <span className={index === stepIndex ? 'active' : ''} key={guideStep.title} />
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeGuide} type="button">
                Skip Tutorial
              </button>
              <button
                onClick={() => {
                  if (isLastStep) {
                    closeGuide()
                    return
                  }
                  setStepIndex((current) => current + 1)
                }}
                type="button"
              >
                {isLastStep ? 'Finish' : 'next'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

function LoginScreen({
  onSubmit,
}: {
  onSubmit: (data: z.infer<typeof loginInputSchema>) => Promise<void>
}) {
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onChange: loginInputSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        await onSubmit(value)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Login failed.')
      }
    },
  })

  return (
    <main className="auth-shell">
      <form
        className="auth-panel"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <p className="eyebrow">Operator login</p>
        <h1>Social Media Director</h1>
        <form.Field name="email">
          {(field) => (
            <label>
              Email
              <input
                autoComplete="username"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="email"
                value={field.state.value}
              />
              <small className="field-guidance">Use the email you registered for this self-hosted dashboard.</small>
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <label>
              Password
              <input
                autoComplete="current-password"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="password"
                value={field.state.value}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        <button type="submit">Log in</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
  )
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings: PublicSettingsStatus | null
  onSave: (data: z.infer<typeof settingsInputSchema>) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<string>()
  const form = useForm({
    defaultValues: {
      aiProvider: settings?.aiProvider === 'codexCli' ? 'codexCli' : 'openaiApiKey',
      openaiApiKey: '',
      openaiModel: settings?.openaiModel ?? 'gpt-4.1-mini',
      codexCliModel: settings?.codexCliModel ?? 'gpt-5.2',
      xAccessToken: '',
      linkedinAccessToken: '',
      linkedinAuthorUrn: '',
      linkedinApiVersion: settings?.linkedinApiVersion ?? '202604',
    },
    validators: {
      onChange: settingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(undefined)
      try {
        await onSave({
          aiProvider: value.aiProvider as 'openaiApiKey' | 'codexCli',
          openaiApiKey: value.openaiApiKey || undefined,
          openaiModel: value.openaiModel,
          codexCliModel: value.codexCliModel,
          xAccessToken: value.xAccessToken || undefined,
          linkedinAccessToken: value.linkedinAccessToken || undefined,
          linkedinAuthorUrn: value.linkedinAuthorUrn || undefined,
          linkedinApiVersion: value.linkedinApiVersion,
        })
        setMessage('Settings saved.')
        form.setFieldValue('openaiApiKey', '')
        form.setFieldValue('xAccessToken', '')
        form.setFieldValue('linkedinAccessToken', '')
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Settings failed to save.')
      }
    },
  })

  return (
    <section className="settings-panel" id="settings">
      <div>
        <h2>Configuration</h2>
        <p>
          Model, X, and LinkedIn credentials are stored encrypted in this self-hosted
          database.
        </p>
      </div>
      <div className="settings-actions">
        <LinkedInApiGuide compact />
        <button className="secondary-button" onClick={() => setIsOpen(!isOpen)} type="button">
          {isOpen ? 'Close settings' : 'Edit settings'}
        </button>
      </div>
      {isOpen ? (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="openaiApiKey">
            {(field) => (
              <label>
                OpenAI API key
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={settings?.modelConfigured ? 'Configured' : 'Required'}
                  type="password"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="aiProvider">
            {(field) => (
              <label>
                AI backend
                <select
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value as 'openaiApiKey' | 'codexCli')
                  }
                  value={field.state.value}
                >
                  <option value="openaiApiKey">OpenAI API key</option>
                  <option value="codexCli">Local Codex CLI</option>
                </select>
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="openaiModel">
            {(field) => (
              <label>
                Model
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="codexCliModel">
            {(field) => (
              <label>
                Codex CLI model
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="xAccessToken">
            {(field) => (
              <label>
                X access token
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={settings?.xConfigured ? 'Configured' : 'Optional'}
                  type="password"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="linkedinAccessToken">
            {(field) => (
              <label>
                LinkedIn access token
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={settings?.linkedinConfigured ? 'Configured' : 'Optional'}
                  type="password"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="linkedinAuthorUrn">
            {(field) => (
              <label>
                LinkedIn author URN
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="urn:li:person:..."
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <form.Field name="linkedinApiVersion">
            {(field) => (
              <label>
                LinkedIn API version
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
          <div className="settings-form-guide">
            <LinkedInApiGuide />
          </div>
          <button type="submit">Save settings</button>
          {message ? <p className="publish-state">{message}</p> : null}
        </form>
      ) : null}
    </section>
  )
}
