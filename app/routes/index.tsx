import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  FileText,
  KeyRound,
  Link2,
  PenLine,
  Send,
  Sparkles,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { AppLayout } from '../components/app-layout'
import { generateProviderVariants } from '../lib/ai/generate-variants'
import { getDb } from '../lib/db/client'
import type { ProviderVariant } from '../lib/domain/providers'
import { validateProviderPayload } from '../lib/domain/validation'
import { importPublicBlogUrl } from '../lib/import/public-url'
import { getProviderAdapter } from '../lib/providers'
import { hashPassword, verifyPassword } from '../lib/server/crypto'
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

const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const accountStepInputSchema = z.object({
  firstName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12),
})

const modelStepInputSchema = z.object({
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().min(1).default('gpt-4.1-mini'),
})

const socialStepInputSchema = z.object({
  xAccessToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})

const settingsInputSchema = z.object({
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  xAccessToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})

const publishInputSchema = z.object({
  provider: z.enum(['x', 'linkedin']),
  text: z.string().min(1),
  linkUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
})

const getBootstrapState = createServerFn({ method: 'GET' }).handler(async () => {
  const operatorCount = await getDb().query<{ count: string }>(
    'select count(*)::text as count from operators',
  )
  const hasOperator = Number(operatorCount.rows[0]?.count ?? '0') > 0
  const session = hasOperator ? await readOperatorSession() : null
  const settings = hasOperator && session ? await getPublicSettingsStatus() : null

  return {
    hasOperator,
    isAuthenticated: Boolean(session),
    operatorEmail: session?.email,
    operatorFirstName: session?.firstName,
    onboardingStepCompleted: session?.onboardingStepCompleted ?? 0,
    settings,
  }
})

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
      [data.email.toLowerCase(), data.firstName.trim(), passwordHash],
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
      openaiApiKey: data.openaiApiKey,
      openaiModel: data.openaiModel,
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
    await requireOperatorSession()
    const settings = await getAppSettings()
    const source = await importPublicBlogUrl(data.url)
    const variants = await generateProviderVariants(
      {
        source,
        intentPrompt: data.intentPrompt,
      },
      {
        openaiApiKey: settings.openaiApiKey,
        openaiModel: settings.openaiModel,
      },
    )

    return {
      source,
      variants: variants.map((variant) => ({
        ...variant,
        validation: validateProviderPayload(variant.provider, variant),
      })),
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
  loader: () => getBootstrapState(),
  component: Dashboard,
})

type ImportResult = Awaited<ReturnType<typeof importAndGenerate>>

function getProviderLabel(provider: ProviderVariant['provider']) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}

function Dashboard() {
  const bootstrap = Route.useLoaderData()
  const importAndGenerateFn = useServerFn(importAndGenerate)
  const publishVariantFn = useServerFn(publishVariant)
  const saveAccountStepFn = useServerFn(saveAccountStep)
  const saveModelStepFn = useServerFn(saveModelStep)
  const saveSocialStepFn = useServerFn(saveSocialStep)
  const loginOperatorFn = useServerFn(loginOperator)
  const logoutOperatorFn = useServerFn(logoutOperator)
  const saveSettingsFn = useServerFn(saveSettings)

  const [authState, setAuthState] = useState(() => bootstrap)
  const [url, setUrl] = useState('')
  const [intentPrompt, setIntentPrompt] = useState('')
  const [result, setResult] = useState<ImportResult | undefined>()
  const [variants, setVariants] = useState<ProviderVariant[]>([])
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [publishState, setPublishState] = useState<Record<string, string>>({})

  if (!authState.hasOperator) {
    return (
      <OnboardingWizard
        mode="first-run"
        onboardingStepCompleted={0}
        settings={null}
        onAccountSave={async (data) => {
          const result = await saveAccountStepFn({ data })
          setAuthState({
            hasOperator: true,
            isAuthenticated: true,
            operatorEmail: data.email.toLowerCase(),
            operatorFirstName: data.firstName,
            onboardingStepCompleted: result.onboardingStepCompleted,
            settings: result.settings,
          })
        }}
        onModelSave={async (data) => {
          const result = await saveModelStepFn({ data })
          setAuthState((current) => ({
            ...current,
            onboardingStepCompleted: result.onboardingStepCompleted,
            settings: result.settings,
          }))
        }}
        onSocialSave={async (data) => {
          const result = await saveSocialStepFn({ data })
          setAuthState((current) => ({
            ...current,
            onboardingStepCompleted: result.onboardingStepCompleted,
            settings: result.settings,
          }))
        }}
      />
    )
  }

  if (!authState.isAuthenticated) {
    return (
      <LoginScreen
        onSubmit={async (data) => {
          const result = await loginOperatorFn({ data })
          setAuthState({
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

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(undefined)

    try {
      const nextResult = await importAndGenerateFn({
        data: { url, intentPrompt: intentPrompt || undefined },
      })
      setResult(nextResult)
      setVariants(nextResult.variants)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.')
    } finally {
      setIsLoading(false)
    }
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
    setAuthState({
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
      value: authState.settings?.modelConfigured ? 'Ready' : 'Missing',
      isReady: Boolean(authState.settings?.modelConfigured),
      icon: Bot,
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
      operatorName={authState.operatorFirstName ?? authState.operatorEmail ?? 'Signed in'}
    >
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP V1</p>
            <h1>Social Media Director</h1>
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
          {statusCards.map((card) => (
            <article className="stat-card" key={card.label}>
              <div className={card.isReady ? 'stat-icon ready' : 'stat-icon'}>
                <card.icon aria-hidden="true" size={22} />
              </div>
              <div>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
              </div>
            </article>
          ))}
        </section>

      {authState.onboardingStepCompleted < 3 ? (
        <OnboardingWizard
          mode="resume"
          onboardingStepCompleted={authState.onboardingStepCompleted}
          settings={authState.settings}
          onModelSave={async (data) => {
            const result = await saveModelStepFn({ data })
            setAuthState((current) => ({
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: result.settings,
            }))
          }}
          onSocialSave={async (data) => {
            const result = await saveSocialStepFn({ data })
            setAuthState((current) => ({
              ...current,
              onboardingStepCompleted: result.onboardingStepCompleted,
              settings: result.settings,
            }))
          }}
        />
      ) : null}

      <SettingsPanel
        settings={authState.settings}
        onSave={async (data) => {
          const settings = await saveSettingsFn({ data })
          setAuthState((current) => ({ ...current, settings }))
        }}
      />

      <section className="workspace" id="workspace">
        <form className="import-panel" onSubmit={onImport}>
          <div className="panel-heading">
            <Sparkles aria-hidden="true" size={22} />
            <div>
              <h2>AI Content Assistant</h2>
              <p>Paste a source URL and add direction for the generated drafts.</p>
            </div>
          </div>
          <label>
            Blog post URL
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/blog/product-update"
              required
              type="url"
            />
          </label>
          <label>
            Optional direction
            <textarea
              value={intentPrompt}
              onChange={(event) => setIntentPrompt(event.target.value)}
              placeholder="Emphasize the launch angle and invite readers to try it."
              rows={4}
            />
          </label>
          <button disabled={isLoading} type="submit">
            {isLoading ? 'Generating...' : 'Import and generate'}
          </button>
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
                <div>
                  <p className="eyebrow">Platform draft</p>
                  <h2>{getProviderLabel(variant.provider)}</h2>
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
  const [step, setStep] = useState(Math.min(onboardingStepCompleted + 1, 3))
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [accountForm, setAccountForm] = useState({
    firstName: '',
    email: '',
    password: '',
  })
  const [modelForm, setModelForm] = useState({
    openaiApiKey: '',
    openaiModel: settings?.openaiModel ?? 'gpt-4.1-mini',
  })
  const [socialForm, setSocialForm] = useState({
    xAccessToken: '',
    linkedinAccessToken: '',
    linkedinAuthorUrn: '',
    linkedinApiVersion: settings?.linkedinApiVersion ?? '202604',
  })

  const shellClass = mode === 'first-run' ? 'auth-shell' : 'wizard-shell'
  const panelClass = mode === 'first-run' ? 'auth-panel onboarding-panel' : 'wizard-panel'

  async function skipModelStep() {
    setError(undefined)
    setMessage(undefined)
    try {
      await onModelSave({ openaiModel: modelForm.openaiModel })
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
      await onSocialSave({ linkedinApiVersion: socialForm.linkedinApiVersion })
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

        {step === 1 ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError(undefined)
              setMessage(undefined)
              try {
                if (!onAccountSave) throw new Error('Account setup is already complete.')
                await onAccountSave(accountForm)
                setMessage('Account saved. You can continue setup now or come back later.')
                setStep(2)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Account setup failed.')
              }
            }}
          >
            <p className="setup-copy">
              Create the local operator account for this self-hosted install. This login is
              only for your dashboard and is separate from OpenAI, X, or LinkedIn.
            </p>
            <div className="form-grid">
              <label>
                First name
                <input
                  onChange={(event) =>
                    setAccountForm({ ...accountForm, firstName: event.target.value })
                  }
                  required
                  value={accountForm.firstName}
                />
              </label>
              <label>
                Operator email
                <input
                  onChange={(event) =>
                    setAccountForm({ ...accountForm, email: event.target.value })
                  }
                  required
                  type="email"
                  value={accountForm.email}
                />
              </label>
              <label>
                Password
                <input
                  minLength={12}
                  onChange={(event) =>
                    setAccountForm({ ...accountForm, password: event.target.value })
                  }
                  required
                  type="password"
                  value={accountForm.password}
                />
              </label>
            </div>
            <button type="submit">Save account</button>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError(undefined)
              setMessage(undefined)
              try {
                await onModelSave({
                  openaiApiKey: modelForm.openaiApiKey || undefined,
                  openaiModel: modelForm.openaiModel,
                })
                setMessage('Model settings saved. You can continue or come back later.')
                setStep(3)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Model setup failed.')
              }
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
              <label>
                OpenAI API key
                <input
                  onChange={(event) =>
                    setModelForm({ ...modelForm, openaiApiKey: event.target.value })
                  }
                  placeholder={settings?.modelConfigured ? 'Configured' : 'Optional'}
                  type="password"
                  value={modelForm.openaiApiKey}
                />
              </label>
              <label>
                Model
                <input
                  onChange={(event) =>
                    setModelForm({ ...modelForm, openaiModel: event.target.value })
                  }
                  value={modelForm.openaiModel}
                />
              </label>
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
            onSubmit={async (event) => {
              event.preventDefault()
              setError(undefined)
              setMessage(undefined)
              try {
                await onSocialSave({
                  xAccessToken: socialForm.xAccessToken || undefined,
                  linkedinAccessToken: socialForm.linkedinAccessToken || undefined,
                  linkedinAuthorUrn: socialForm.linkedinAuthorUrn || undefined,
                  linkedinApiVersion: socialForm.linkedinApiVersion,
                })
                setMessage('Social integrations saved. Onboarding is complete.')
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Social setup failed.')
              }
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
            <div className="form-grid">
              <label>
                X access token
                <input
                  onChange={(event) =>
                    setSocialForm({ ...socialForm, xAccessToken: event.target.value })
                  }
                  placeholder={settings?.xConfigured ? 'Configured' : 'Optional'}
                  type="password"
                  value={socialForm.xAccessToken}
                />
              </label>
              <label>
                LinkedIn access token
                <input
                  onChange={(event) =>
                    setSocialForm({ ...socialForm, linkedinAccessToken: event.target.value })
                  }
                  placeholder={settings?.linkedinConfigured ? 'Configured' : 'Optional'}
                  type="password"
                  value={socialForm.linkedinAccessToken}
                />
              </label>
              <label>
                LinkedIn author URN
                <input
                  onChange={(event) =>
                    setSocialForm({ ...socialForm, linkedinAuthorUrn: event.target.value })
                  }
                  placeholder="urn:li:person:..."
                  value={socialForm.linkedinAuthorUrn}
                />
              </label>
              <label>
                LinkedIn API version
                <input
                  onChange={(event) =>
                    setSocialForm({ ...socialForm, linkedinApiVersion: event.target.value })
                  }
                  value={socialForm.linkedinApiVersion}
                />
              </label>
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

function LoginScreen({
  onSubmit,
}: {
  onSubmit: (data: z.infer<typeof loginInputSchema>) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()

  return (
    <main className="auth-shell">
      <form
        className="auth-panel"
        onSubmit={async (event) => {
          event.preventDefault()
          setError(undefined)
          try {
            await onSubmit({ email, password })
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Login failed.')
          }
        }}
      >
        <p className="eyebrow">Operator login</p>
        <h1>Social Media Director</h1>
        <label>
          Email
          <input
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
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
  const [form, setForm] = useState({
    openaiApiKey: '',
    openaiModel: settings?.openaiModel ?? 'gpt-4.1-mini',
    xAccessToken: '',
    linkedinAccessToken: '',
    linkedinAuthorUrn: '',
    linkedinApiVersion: settings?.linkedinApiVersion ?? '202604',
  })
  const [message, setMessage] = useState<string>()

  return (
    <section className="settings-panel" id="settings">
      <div>
        <h2>Configuration</h2>
        <p>
          Model, X, and LinkedIn credentials are stored encrypted in this self-hosted
          database.
        </p>
      </div>
      <button className="secondary-button" onClick={() => setIsOpen(!isOpen)} type="button">
        {isOpen ? 'Close settings' : 'Edit settings'}
      </button>
      {isOpen ? (
        <form
          className="settings-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setMessage(undefined)
            try {
              await onSave({
                openaiApiKey: form.openaiApiKey || undefined,
                openaiModel: form.openaiModel,
                xAccessToken: form.xAccessToken || undefined,
                linkedinAccessToken: form.linkedinAccessToken || undefined,
                linkedinAuthorUrn: form.linkedinAuthorUrn || undefined,
                linkedinApiVersion: form.linkedinApiVersion,
              })
              setMessage('Settings saved.')
              setForm((current) => ({
                ...current,
                openaiApiKey: '',
                xAccessToken: '',
                linkedinAccessToken: '',
              }))
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : 'Settings failed to save.')
            }
          }}
        >
          <label>
            OpenAI API key
            <input
              onChange={(event) => setForm({ ...form, openaiApiKey: event.target.value })}
              placeholder={settings?.modelConfigured ? 'Configured' : 'Required'}
              type="password"
              value={form.openaiApiKey}
            />
          </label>
          <label>
            Model
            <input
              onChange={(event) => setForm({ ...form, openaiModel: event.target.value })}
              value={form.openaiModel}
            />
          </label>
          <label>
            X access token
            <input
              onChange={(event) => setForm({ ...form, xAccessToken: event.target.value })}
              placeholder={settings?.xConfigured ? 'Configured' : 'Optional'}
              type="password"
              value={form.xAccessToken}
            />
          </label>
          <label>
            LinkedIn access token
            <input
              onChange={(event) =>
                setForm({ ...form, linkedinAccessToken: event.target.value })
              }
              placeholder={settings?.linkedinConfigured ? 'Configured' : 'Optional'}
              type="password"
              value={form.linkedinAccessToken}
            />
          </label>
          <label>
            LinkedIn author URN
            <input
              onChange={(event) => setForm({ ...form, linkedinAuthorUrn: event.target.value })}
              placeholder="urn:li:person:..."
              value={form.linkedinAuthorUrn}
            />
          </label>
          <label>
            LinkedIn API version
            <input
              onChange={(event) => setForm({ ...form, linkedinApiVersion: event.target.value })}
              value={form.linkedinApiVersion}
            />
          </label>
          <button type="submit">Save settings</button>
          {message ? <p className="publish-state">{message}</p> : null}
        </form>
      ) : null}
    </section>
  )
}
