import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
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
import type { z } from 'zod'
import { ActiveAiBackendControl } from '../components/active-ai-backend-control'
import { AiWorkspace } from '../components/ai-workspace'
import { AppLayout } from '../components/app-layout'
import { DebouncedFieldErrors } from '../components/debounced-field-errors'
import { PasswordInput } from '../components/password-input'
import { PlatformIcon } from '../components/platform-icons'
import { XApiGuide, XCredentialMappingTable } from '../components/x-api-guide'
import {
  bootstrapQueryKey,
  bootstrapQueryOptions,
  type BootstrapState,
} from '../lib/bootstrap-query'
import { PASSWORD_MIN_LENGTH } from '../lib/password-schema'
import {
  accountStepFormSchema,
  accountStepInputSchema,
  importFormSchema,
  linkedinStepFormSchema,
  linkedinStepInputSchema,
  loginInputSchema,
  xStepFormSchema,
  xStepInputSchema,
} from '../lib/dashboard-schemas'
import { isDatabaseConnectionError } from '../lib/db/errors'
import type { ProviderVariant } from '../lib/domain/providers'
import { validateProviderPayload } from '../lib/domain/validation'
import type { CodexCliStatus } from '../lib/server/codex-cli'
import type { PublicSettingsStatus } from '../lib/server/settings'
import {
  advanceModelStep,
  dismissOnboardingWizard,
  importAndGenerate,
  loginOperator,
  logoutOperator,
  publishVariant,
  saveAccountStep,
  saveLinkedInStep,
  saveXStep,
  type ImportResult,
} from '../server/dashboard'

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(bootstrapQueryOptions()),
  component: Dashboard,
  errorComponent: DashboardError,
})

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
          <code>psql "$DATABASE_URL" -f migrations/0004_x_linkedin_onboarding_steps.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0005_onboarding_dismissed.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0006_operator_ai_settings.sql</code>
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

  if (settings.activeAiBackendType === 'codexCli') {
    return `Ready: Codex CLI / ${settings.codexCliModel ?? 'model'}`
  }

  if (settings.activeAiBackendType === 'openaiApiKey') {
    return `Ready: OpenAI API / ${settings.openaiModel ?? 'model'}`
  }

  return 'Configured'
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
  const advanceModelStepFn = useServerFn(advanceModelStep)
  const saveXStepFn = useServerFn(saveXStep)
  const saveLinkedInStepFn = useServerFn(saveLinkedInStep)
  const dismissOnboardingWizardFn = useServerFn(dismissOnboardingWizard)
  const loginOperatorFn = useServerFn(loginOperator)
  const logoutOperatorFn = useServerFn(logoutOperator)

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
        const activeBackend = authState.settings?.activeAiBackendType
        const providerLabel =
          activeBackend === 'codexCli'
            ? 'Codex CLI'
            : activeBackend === 'openaiApiKey'
              ? 'OpenAI API'
              : authState.settings?.modelConfigured
                ? 'configured AI'
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
        codexCli={authState.codexCli}
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
            onboardingDismissed: false,
            settings: result.settings,
            codexCli: result.codexCli,
            instanceConfigured: authState.instanceConfigured,
            isInstanceOwner: true,
            activeProjectId: null,
            projects: [],
            connectedChannels: [],
          })
        }}
        onModelStepComplete={async (nextSettings) => {
          const result = await advanceModelStepFn()
          updateBootstrapState((current) => {
            if (!current.databaseAvailable) return current
            return {
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: nextSettings ?? result.settings,
            }
          })
          return {
            ...result,
            settings: nextSettings ?? result.settings,
          }
        }}
        onXSave={async (data) => {
          const result = await saveXStepFn({ data })
          updateBootstrapState((current) => {
            if (!current.databaseAvailable) return current
            return {
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: result.settings,
            }
          })
        }}
        onLinkedInSave={async (data) => {
          const result = await saveLinkedInStepFn({ data })
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
            onboardingDismissed: result.onboardingDismissed,
            settings: result.settings,
            codexCli: result.codexCli,
            instanceConfigured: authState.instanceConfigured,
            isInstanceOwner: authState.isInstanceOwner,
            activeProjectId: authState.activeProjectId,
            projects: authState.projects,
            connectedChannels: authState.connectedChannels,
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
      onboardingDismissed: false,
      settings: null,
      codexCli: null,
      instanceConfigured: authState.instanceConfigured,
      isInstanceOwner: false,
      activeProjectId: null,
      projects: [],
      connectedChannels: [],
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
      action: {
        label: 'X settings',
        to: '/settings',
        hash: 'x-publishing',
      },
    },
    {
      label: 'LinkedIn',
      value: authState.settings?.linkedinConfigured ? 'Connected' : 'Not connected',
      isReady: Boolean(authState.settings?.linkedinConfigured),
      icon: Link2,
      action: {
        label: 'LinkedIn settings',
        to: '/settings',
        hash: 'linkedin-publishing',
      },
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
                    aria-label={action.label}
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

      {authState.onboardingStepCompleted < 4 && !authState.onboardingDismissed ? (
        <OnboardingWizard
          codexCli={authState.codexCli}
          mode="resume"
          onboardingStepCompleted={authState.onboardingStepCompleted}
          settings={authState.settings}
          onDismiss={async () => {
            await dismissOnboardingWizardFn()
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return { ...current, onboardingDismissed: true }
            })
          }}
          onModelStepComplete={async (nextSettings) => {
            const result = await advanceModelStepFn()
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return {
                ...current,
                onboardingStepCompleted: result.onboardingStepCompleted,
                settings: nextSettings ?? result.settings,
              }
            })
            return {
              ...result,
              settings: nextSettings ?? result.settings,
            }
          }}
          onXSave={async (data) => {
            const result = await saveXStepFn({ data })
            updateBootstrapState((current) => {
              if (!current.databaseAvailable) return current
              return {
                ...current,
                onboardingStepCompleted: result.onboardingStepCompleted,
                settings: result.settings,
              }
            })
          }}
          onLinkedInSave={async (data) => {
            const result = await saveLinkedInStepFn({ data })
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

      {authState.settings ? (
        authState.settings.configuredAiBackendTypes.length > 0 ? (
          <ActiveAiBackendControl
            onChange={(nextSettings) => {
              updateBootstrapState((current) => {
                if (!current.databaseAvailable) return current
                return { ...current, settings: nextSettings }
              })
            }}
            settings={authState.settings}
          />
        ) : (
          <AiWorkspace
            codexCli={authState.codexCli}
            compactIntro
            onSaved={(nextSettings) => {
              updateBootstrapState((current) => {
                if (!current.databaseAvailable) return current
                return { ...current, settings: nextSettings }
              })
            }}
            settings={authState.settings}
          />
        )
      ) : null}

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

const onboardingWizardSteps = [
  { id: 1, label: 'Account', firstRunOnly: true },
  { id: 2, label: 'Model' },
  { id: 3, label: 'X' },
  { id: 4, label: 'LinkedIn' },
] as const

function isOnboardingStepConfigured(
  stepId: number,
  settings: PublicSettingsStatus | null,
  onboardingStepCompleted: number,
) {
  switch (stepId) {
    case 1:
      return onboardingStepCompleted >= 1
    case 2:
      return Boolean(settings?.modelConfigured)
    case 3:
      return Boolean(settings?.xConfigured)
    case 4:
      return Boolean(settings?.linkedinConfigured)
    default:
      return false
  }
}

function getOnboardingStepIndicatorClass(
  stepId: number,
  currentStep: number,
  settings: PublicSettingsStatus | null,
  onboardingStepCompleted: number,
) {
  if (currentStep === stepId) return 'active'
  if (isOnboardingStepConfigured(stepId, settings, onboardingStepCompleted)) return 'done'
  if (onboardingStepCompleted >= stepId) return 'skipped'
  return ''
}

function canVisitOnboardingStep(
  target: number,
  mode: 'first-run' | 'resume',
  currentStep: number,
  onboardingStepCompleted: number,
) {
  if (mode === 'resume') return target >= 2 && target <= 4
  const furthest = Math.min(4, Math.max(currentStep, onboardingStepCompleted + 1))
  return target >= 1 && target <= furthest
}

function getResumeOnboardingStep(
  onboardingStepCompleted: number,
  settings: PublicSettingsStatus | null,
) {
  if (!settings?.modelConfigured) return 2
  if (!settings?.xConfigured) return 3
  if (!settings?.linkedinConfigured) return 4
  return Math.min(4, Math.max(2, onboardingStepCompleted + 1))
}

function OnboardingWizard({
  mode,
  onboardingStepCompleted,
  settings,
  codexCli,
  onAccountSave,
  onModelStepComplete,
  onXSave,
  onLinkedInSave,
  onDismiss,
}: {
  mode: 'first-run' | 'resume'
  onboardingStepCompleted: number
  settings: PublicSettingsStatus | null
  codexCli: CodexCliStatus | null
  onAccountSave?: (data: z.infer<typeof accountStepInputSchema>) => Promise<void>
  onModelStepComplete: (
    settings?: PublicSettingsStatus,
  ) => Promise<{
    settings: PublicSettingsStatus
    onboardingStepCompleted: number
  }>
  onXSave: (data: z.infer<typeof xStepInputSchema>) => Promise<void>
  onLinkedInSave: (data: z.infer<typeof linkedinStepInputSchema>) => Promise<void>
  onDismiss?: () => Promise<void>
}) {
  const initialStep =
    mode === 'first-run'
      ? Math.min(onboardingStepCompleted + 1, 4)
      : getResumeOnboardingStep(onboardingStepCompleted, settings)
  const [step, setStep] = useState(initialStep)
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [showPasswordFieldErrors, setShowPasswordFieldErrors] = useState(false)
  const [showConfirmPasswordErrors, setShowConfirmPasswordErrors] = useState(false)
  const accountForm = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
    },
    validators: {
      onChange: accountStepFormSchema,
    },
    onSubmitInvalid: () => {
      setShowPasswordFieldErrors(true)
      setShowConfirmPasswordErrors(true)
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        if (!onAccountSave) throw new Error('Account setup is already complete.')
        const { confirmPassword: _confirmPassword, ...accountData } = value
        await onAccountSave(accountData)
        setMessage('Account saved. You can continue setup now or come back later.')
        setStep(2)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Account setup failed.')
      }
    },
  })
  const xForm = useForm({
    defaultValues: {
      xAccessToken: '',
      xRefreshToken: '',
    },
    validators: {
      onChange: xStepFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        await onXSave({
          xAccessToken: value.xAccessToken || undefined,
          xRefreshToken: value.xRefreshToken || undefined,
        })
        setMessage('X credentials saved. Continue to LinkedIn or finish later.')
        setStep(4)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'X setup failed.')
      }
    },
  })

  const linkedinForm = useForm({
    defaultValues: {
      linkedinAccessToken: '',
      linkedinAuthorUrn: '',
      linkedinApiVersion: settings?.linkedinApiVersion ?? '202604',
    },
    validators: {
      onChange: linkedinStepFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        await onLinkedInSave({
          linkedinAccessToken: value.linkedinAccessToken || undefined,
          linkedinAuthorUrn: value.linkedinAuthorUrn || undefined,
          linkedinApiVersion: value.linkedinApiVersion,
        })
        setMessage('LinkedIn credentials saved. Onboarding is complete.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'LinkedIn setup failed.')
      }
    },
  })

  const shellClass = mode === 'first-run' ? 'auth-shell' : 'wizard-shell'
  const panelClass = mode === 'first-run' ? 'auth-panel onboarding-panel' : 'wizard-panel'

  async function skipModelStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onModelStepComplete()
      setMessage('Model step skipped. You can add an AI backend later in settings.')
      setStep(3)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Model setup failed.')
    }
  }

  async function completeModelStepAfterSave(nextSettings: PublicSettingsStatus) {
    setError(undefined)
    setMessage(undefined)
    try {
      await onModelStepComplete(nextSettings)
      setMessage('Model settings saved. You can continue or come back later.')
      setStep(3)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Model setup failed.')
      throw caught
    }
  }

  async function skipXStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onXSave({})
      setMessage('X step skipped. Continue to LinkedIn when ready.')
      setStep(4)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'X setup failed.')
    }
  }

  async function skipLinkedInStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onLinkedInSave({
        linkedinApiVersion: linkedinForm.state.values.linkedinApiVersion,
      })
      setMessage('LinkedIn step skipped. Onboarding is complete.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'LinkedIn setup failed.')
    }
  }

  async function dismissWizard() {
    if (!onDismiss) return
    setError(undefined)
    setMessage(undefined)
    try {
      await onDismiss()
      setMessage('Setup hidden from the dashboard. Open Settings anytime to finish connecting providers.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not dismiss setup.')
    }
  }

  return (
    <main className={shellClass}>
      <section className={panelClass}>
        <div className="wizard-panel-top">
          <div>
            <p className="eyebrow">{mode === 'first-run' ? 'First run' : 'Finish setup'}</p>
            <h1>{mode === 'first-run' ? 'Set up Social Media Director' : 'Continue onboarding'}</h1>
          </div>
          {mode === 'resume' && onDismiss ? (
            <button
              aria-label="Dismiss setup from dashboard"
              className="icon-button wizard-dismiss"
              onClick={() => void dismissWizard()}
              title="Hide setup wizard"
              type="button"
            >
              <XIcon aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
        <div className="stepper" aria-label="Onboarding progress">
          {onboardingWizardSteps.map((wizardStep) => {
            if ('firstRunOnly' in wizardStep && wizardStep.firstRunOnly && mode !== 'first-run') {
              return null
            }
            const reachable = canVisitOnboardingStep(
              wizardStep.id,
              mode,
              step,
              onboardingStepCompleted,
            )
            const indicatorClass = getOnboardingStepIndicatorClass(
              wizardStep.id,
              step,
              settings,
              onboardingStepCompleted,
            )

            return (
              <button
                aria-current={step === wizardStep.id ? 'step' : undefined}
                className={indicatorClass || undefined}
                disabled={!reachable}
                key={wizardStep.id}
                onClick={() => {
                  if (!reachable) return
                  setError(undefined)
                  setMessage(undefined)
                  setStep(wizardStep.id)
                }}
                type="button"
              >
                {wizardStep.id} {wizardStep.label}
              </button>
            )
          })}
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
            <div className="form-grid form-grid--account">
              <accountForm.Field name="email">
                {(field) => (
                  <label className="form-field">
                    <span className="field-label">Operator email</span>
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
                    <div className="field-messages">
                      <small className="field-guidance">
                        Use the email you want for dashboard login and recovery context.
                      </small>
                      <FieldErrors errors={field.state.meta.errors} />
                    </div>
                  </label>
                )}
              </accountForm.Field>
              <accountForm.Field name="firstName">
                {(field) => (
                  <label className="form-field">
                    <span className="field-label">
                      First name <span className="optional-label">Optional</span>
                    </span>
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                    <div className="field-messages">
                      <FieldErrors errors={field.state.meta.errors} />
                    </div>
                  </label>
                )}
              </accountForm.Field>
              <accountForm.Field name="password">
                {(field) => (
                  <label className="form-field">
                    <span className="field-label">Password</span>
                    <PasswordInput
                      autoComplete="new-password"
                      name={field.name}
                      onBlur={() => {
                        field.handleBlur()
                        setShowPasswordFieldErrors(true)
                      }}
                      onChange={(event) => {
                        setShowPasswordFieldErrors(false)
                        field.handleChange(event.target.value)
                      }}
                      required
                      value={field.state.value}
                    />
                    <div className="field-messages field-messages--requirements">
                      <small className="field-guidance">
                        Use {PASSWORD_MIN_LENGTH}+ characters with a letter, number, and symbol.
                      </small>
                      <DebouncedFieldErrors
                        errors={field.state.meta.errors}
                        showImmediately={showPasswordFieldErrors}
                        value={field.state.value}
                      />
                    </div>
                  </label>
                )}
              </accountForm.Field>
              <accountForm.Field name="confirmPassword">
                {(field) => (
                  <label className="form-field">
                    <span className="field-label">Confirm password</span>
                    <PasswordInput
                      autoComplete="new-password"
                      name={field.name}
                      onBlur={() => {
                        field.handleBlur()
                        setShowConfirmPasswordErrors(true)
                      }}
                      onChange={(event) => {
                        setShowConfirmPasswordErrors(false)
                        field.handleChange(event.target.value)
                      }}
                      required
                      value={field.state.value}
                    />
                    <div className="field-messages">
                      <small className="field-guidance">Re-enter the same password to confirm.</small>
                      <DebouncedFieldErrors
                        errors={field.state.meta.errors}
                        showImmediately={showConfirmPasswordErrors}
                        value={field.state.value}
                      />
                    </div>
                  </label>
                )}
              </accountForm.Field>
            </div>
            <button type="submit">Save account</button>
          </form>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-model-step">
            <p className="setup-copy">
              Optional: configure an AI backend for generated social copy. Test the
              connection, pick a model, then save—or skip and write posts manually.
            </p>
            {onboardingStepCompleted >= 2 && !settings?.modelConfigured ? (
              <p className="setup-callout" role="status">
                You skipped this step earlier (amber in the step bar). Configure a backend
                below or keep writing posts manually.
              </p>
            ) : null}
            {settings ? (
              <AiWorkspace
                codexCli={codexCli}
                compactIntro
                onSaved={async (nextSettings) => {
                  await completeModelStepAfterSave(nextSettings)
                }}
                saveLabel="Save and continue"
                settings={settings}
                showSaveButton
              />
            ) : (
              <p className="setup-copy">Sign in to configure AI generation.</p>
            )}
            <div className="button-row">
              <button className="secondary-button" onClick={() => void skipModelStep()} type="button">
                Skip for now
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void xForm.handleSubmit()
            }}
          >
            <p className="setup-copy">
              Optional: connect X for direct API publishing. Use{' '}
              <a href="https://developer.x.com/en/portal/dashboard">developer.x.com</a> to
              generate an OAuth 2.0 <strong>user</strong> access token (not the app-only
              Bearer Token).
            </p>
            <XApiGuide />
            <XCredentialMappingTable />
            <div className="form-grid">
              <xForm.Field name="xAccessToken">
                {(field) => (
                  <label>
                    X user access token (OAuth 2.0)
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={
                        settings?.xConfigured
                          ? 'Configured'
                          : 'User Access Token from Authentication Tokens'
                      }
                      type="password"
                      value={field.state.value}
                    />
                    <small className="field-guidance">
                      Not API Key, Secret, or app-only Bearer Token—see the mapping table
                      above.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </xForm.Field>
              <xForm.Field name="xRefreshToken">
                {(field) => (
                  <label>
                    X refresh token (optional)
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={
                        settings?.xRefreshConfigured
                          ? 'Configured'
                          : 'From offline.access / Include refresh token'
                      }
                      type="password"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </xForm.Field>
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                onClick={() => setStep(2)}
                type="button"
              >
                Back to model
              </button>
              <button type="submit">Save X step</button>
              <button
                className="secondary-button"
                onClick={() => void skipXStep()}
                type="button"
              >
                Skip for now
              </button>
            </div>
          </form>
        ) : null}

        {step === 4 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void linkedinForm.handleSubmit()
            }}
          >
            <p className="setup-copy">
              Optional: connect LinkedIn for direct API publishing. Create an app at{' '}
              <a href="https://www.linkedin.com/developers/">LinkedIn Developers</a>,
              request the posting product/scopes you need, then use a member or
              organization author URN such as urn:li:person:... or urn:li:organization:....
            </p>
            <LinkedInApiGuide />
            <div className="form-grid">
              <linkedinForm.Field name="linkedinAccessToken">
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
              </linkedinForm.Field>
              <linkedinForm.Field name="linkedinAuthorUrn">
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
              </linkedinForm.Field>
              <linkedinForm.Field name="linkedinApiVersion">
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
              </linkedinForm.Field>
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                onClick={() => setStep(3)}
                type="button"
              >
                Back to X
              </button>
              <button type="submit">Save LinkedIn step</button>
              <button
                className="secondary-button"
                onClick={() => void skipLinkedInStep()}
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

