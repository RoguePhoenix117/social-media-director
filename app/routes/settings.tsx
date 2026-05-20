import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import {
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Link2,
  Save,
  Send,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { AppLayout } from '../components/app-layout'
import { bootstrapQueryKey } from '../lib/bootstrap-query'
import { requireOperatorSession } from '../lib/server/session'
import { logError, logInfo } from '../lib/server/logger'
import {
  getAppSettings,
  getPublicSettingsStatus,
  saveAppSettings,
} from '../lib/server/settings'

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
  openaiModel: z.string().min(1, 'Enter a model name, such as gpt-4.1-mini.'),
  codexCliModel: z.string().min(1, 'Enter a Codex CLI model, such as gpt-5.2.'),
  xAccessToken: z.string(),
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string().min(1, 'Enter a LinkedIn REST API version.'),
})

const modelListInputSchema = z.object({
  openaiApiKey: z.string().optional(),
})

const defaultModelOptions = ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini']
const codexCliModelOptions = ['gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5-mini']

const getSettingsPageState = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireOperatorSession()
  return {
    operatorEmail: session.email,
    operatorFirstName: session.firstName,
    settings: await getPublicSettingsStatus(),
    codexCli: await getCodexCliStatus(),
  }
})

const settingsPageQueryKey = ['settings-page-state'] as const

function settingsPageQueryOptions() {
  return queryOptions({
    queryKey: settingsPageQueryKey,
    queryFn: () => getSettingsPageState(),
  })
}

const saveSettings = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => settingsInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    await saveAppSettings(data)
    return getPublicSettingsStatus()
  })

const refreshCodexCliStatus = createServerFn({ method: 'POST' }).handler(async () => {
  await requireOperatorSession()
  const status = await getCodexCliStatus()
  logInfo('codex_cli.status', {
    installed: status.installed,
    authenticated: status.authenticated,
  })
  return status
})

const listOpenAIModels = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => modelListInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireOperatorSession()
    const settings = await getAppSettings()
    const apiKey = data.openaiApiKey?.trim() || settings.openaiApiKey

    if (!apiKey) {
      throw new Error('Add an OpenAI API key first, then load available models.')
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      logInfo('openai.models.non_ok', { status: response.status })
      const details = await response.text()
      throw new Error(details || 'OpenAI could not list models for this key.')
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> }
    const modelIds = (payload.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id))
      .filter(isUsefulTextModel)
      .sort((left, right) => left.localeCompare(right))

    return modelIds.length ? modelIds : defaultModelOptions
  })

export const Route = createFileRoute('/settings')({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsPageQueryOptions()),
  component: SettingsPage,
})

function SettingsPage() {
  const bootstrap = Route.useLoaderData()
  const queryClient = useQueryClient()
  const { data: pageState } = useQuery({
    ...settingsPageQueryOptions(),
    initialData: bootstrap,
  })
  const saveSettingsFn = useServerFn(saveSettings)
  const listOpenAIModelsFn = useServerFn(listOpenAIModels)
  const refreshCodexCliStatusFn = useServerFn(refreshCodexCliStatus)
  const [message, setMessage] = useState<string>()
  const [modelMessage, setModelMessage] = useState<string>()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const settings = pageState.settings
  const codexCliStatus = pageState.codexCli
  const [availableModels, setAvailableModels] = useState(() => {
    const configured = settings.openaiModel
    return configured && !defaultModelOptions.includes(configured)
      ? [configured, ...defaultModelOptions]
      : defaultModelOptions
  })
  const [postingTarget, setPostingTarget] = useState<'person' | 'organization'>('person')
  const operatorName = pageState.operatorFirstName
    ? pageState.operatorFirstName
    : pageState.operatorEmail
  const markUnsaved = () => {
    setHasUnsavedChanges(true)
    setMessage(undefined)
  }

  const form = useForm({
    defaultValues: {
      aiProvider: settings.aiProvider === 'codexCli' ? 'codexCli' : 'openaiApiKey',
      openaiApiKey: '',
      openaiModel: settings.openaiModel ?? 'gpt-4.1-mini',
      codexCliModel: settings.codexCliModel ?? 'gpt-5.2',
      xAccessToken: '',
      linkedinAccessToken: '',
      linkedinAuthorUrn: '',
      linkedinApiVersion: settings.linkedinApiVersion ?? '202604',
    },
    validators: {
      onChange: settingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(undefined)
      try {
        const nextSettings = await saveSettingsFn({
          data: {
            openaiApiKey: value.openaiApiKey || undefined,
            openaiModel: value.openaiModel,
            aiProvider: value.aiProvider,
            codexCliModel: value.codexCliModel,
            xAccessToken: value.xAccessToken || undefined,
            linkedinAccessToken: value.linkedinAccessToken || undefined,
            linkedinAuthorUrn: value.linkedinAuthorUrn || undefined,
            linkedinApiVersion: value.linkedinApiVersion,
          },
        })
        queryClient.setQueryData(settingsPageQueryKey, {
          ...pageState,
          settings: nextSettings,
        })
        setHasUnsavedChanges(false)
        await queryClient.invalidateQueries({
          queryKey: settingsPageQueryKey,
          refetchType: 'all',
        })
        await queryClient.invalidateQueries({
          queryKey: bootstrapQueryKey,
          refetchType: 'all',
        })
        form.setFieldValue('openaiApiKey', '')
        form.setFieldValue('xAccessToken', '')
        form.setFieldValue('linkedinAccessToken', '')
        setMessage('Settings saved. Secret fields were cleared from the screen after saving.')
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Settings failed to save.')
      }
    },
  })

  async function loadModels(openaiApiKey: string) {
    setModelMessage(undefined)
    try {
      const modelIds = await listOpenAIModelsFn({
        data: { openaiApiKey: openaiApiKey || undefined },
      })
      setAvailableModels(modelIds)
      if (!modelIds.includes(form.state.values.openaiModel)) {
        form.setFieldValue('openaiModel', modelIds[0] ?? 'gpt-5-mini')
        markUnsaved()
      }
      setModelMessage('Models loaded for this API key.')
    } catch (caught) {
      setModelMessage(caught instanceof Error ? caught.message : 'Could not load models.')
    }
  }

  async function refreshCodexStatus() {
    setModelMessage(undefined)
    try {
      const nextStatus = await refreshCodexCliStatusFn()
      queryClient.setQueryData(settingsPageQueryKey, {
        ...pageState,
        codexCli: nextStatus,
      })
      await queryClient.invalidateQueries({
        queryKey: settingsPageQueryKey,
        refetchType: 'all',
      })
      setModelMessage(nextStatus.authenticated ? 'Codex CLI is authenticated.' : nextStatus.message)
    } catch (caught) {
      setModelMessage(caught instanceof Error ? caught.message : 'Could not check Codex CLI.')
    }
  }

  return (
    <AppLayout operatorName={operatorName}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Finish your publishing setup</h1>
          <p className="page-summary">
            Add or replace API keys here at any time. This is the full setup page for
            model generation and social publishing, so skipped onboarding steps can be
            completed later.
          </p>
        </div>
      </header>

      <section className="stats-grid settings-status-grid" aria-label="Configuration status">
        <StatusCard configured={settings.modelConfigured} icon={Bot} label="AI model" />
        <StatusCard configured={settings.xConfigured} icon={Send} label="X publishing" />
        <StatusCard configured={settings.linkedinConfigured} icon={Link2} label="LinkedIn" />
      </section>

      <form
        className="settings-page-grid"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <section className="template-card settings-section ai-workspace-section" id="ai-workspace">
          <div className="panel-heading">
            <Bot aria-hidden="true" size={22} />
            <div>
              <h2>AI workspace</h2>
              <p>
                Choose the generation method for imported posts. Each method keeps its
                own model setting so you can switch without rebuilding the setup.
              </p>
            </div>
          </div>

          <div className={settings.modelConfigured ? 'auth-state-card connected' : 'auth-state-card'}>
            <CheckCircle2 aria-hidden="true" size={18} />
            <div>
              <strong>
                {settings.aiProvider === 'codexCli'
                  ? 'Codex CLI selected'
                  : settings.modelConfigured
                    ? 'API key connected'
                    : 'API key not connected'}
              </strong>
              <p>
                Choose whether this app generates with a saved OpenAI API key or by
                calling your locally authenticated Codex CLI.
              </p>
            </div>
          </div>

          <form.Field name="aiProvider">
            {(field) => (
              <div className="ai-methods" role="radiogroup" aria-label="AI generation method">
                <label
                  className={
                    field.state.value === 'openaiApiKey'
                      ? 'ai-method-card selected'
                      : 'ai-method-card'
                  }
                >
                  <span className="ai-method-summary">
                    <input
                      checked={field.state.value === 'openaiApiKey'}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={() => {
                        setModelMessage(undefined)
                        markUnsaved()
                        field.handleChange('openaiApiKey')
                      }}
                      type="radio"
                      value="openaiApiKey"
                    />
                    <span>
                      <strong>OpenAI API</strong>
                      <small>Use an encrypted API key stored by this app.</small>
                    </span>
                  </span>
                  <span className="ai-method-status">
                    {settings.openaiModel ?? 'gpt-4.1-mini'}
                  </span>
                </label>

                {field.state.value === 'openaiApiKey' ? (
                  <div className="ai-method-panel">
                    <div className="auth-state-card unavailable">
                      <ExternalLink aria-hidden="true" size={18} />
                      <div>
                        <strong>ChatGPT subscription login is separate</strong>
                        <p>
                          ChatGPT Plus/Pro/Business subscriptions do not pay for API calls
                          from this app. Use an API key for OpenAI API mode.
                        </p>
                        <a href="https://help.openai.com/en/articles/9039756" rel="noreferrer" target="_blank">
                          ChatGPT billing vs API billing
                        </a>
                      </div>
                    </div>

                    <div className="ai-method-grid">
                      <form.Field name="openaiApiKey">
                        {(apiField) => (
                          <label>
                            OpenAI API key
                            <input
                              name={apiField.name}
                              onBlur={apiField.handleBlur}
                              onChange={(event) => {
                                markUnsaved()
                                apiField.handleChange(event.target.value)
                              }}
                              placeholder={settings.modelConfigured ? 'Configured' : 'sk-...'}
                              type="password"
                              value={apiField.state.value}
                            />
                            <small className="field-guidance">
                              Create or manage keys at{' '}
                              <a href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">
                                OpenAI API keys
                              </a>
                              .
                            </small>
                            <FieldErrors errors={apiField.state.meta.errors} />
                          </label>
                        )}
                      </form.Field>
                      <form.Field name="openaiModel">
                        {(modelField) => (
                          <label>
                            API model
                            <select
                              name={modelField.name}
                              onBlur={modelField.handleBlur}
                              onChange={(event) => {
                                markUnsaved()
                                modelField.handleChange(event.target.value)
                              }}
                              value={modelField.state.value}
                            >
                              {availableModels.map((modelId) => (
                                <option key={modelId} value={modelId}>
                                  {modelId}
                                </option>
                              ))}
                            </select>
                            <small className="field-guidance">
                              Load models after adding a key to see what your API organization can use.
                            </small>
                            <FieldErrors errors={modelField.state.meta.errors} />
                          </label>
                        )}
                      </form.Field>
                    </div>

                    <form.Field name="openaiApiKey">
                      {(apiField) => (
                        <div className="button-row">
                          <button
                            className="secondary-button"
                            onClick={() => void loadModels(apiField.state.value)}
                            type="button"
                          >
                            Load available models
                          </button>
                          {modelMessage ? <p className="publish-state">{modelMessage}</p> : null}
                        </div>
                      )}
                    </form.Field>
                  </div>
                ) : null}

                <label
                  className={
                    field.state.value === 'codexCli'
                      ? 'ai-method-card selected'
                      : 'ai-method-card'
                  }
                >
                  <span className="ai-method-summary">
                    <input
                      checked={field.state.value === 'codexCli'}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={() => {
                        setModelMessage(undefined)
                        markUnsaved()
                        field.handleChange('codexCli')
                      }}
                      type="radio"
                      value="codexCli"
                    />
                    <span>
                      <strong>Local Codex CLI</strong>
                      <small>Use the locally installed and authenticated codex command.</small>
                    </span>
                  </span>
                  <span className="ai-method-status">
                    {codexCliStatus.authenticated ? 'Ready' : 'Needs setup'}
                  </span>
                </label>

                {field.state.value === 'codexCli' ? (
                  <div className="ai-method-panel">
                    <div className={codexCliStatus.authenticated ? 'auth-state-card connected' : 'auth-state-card'}>
                      <CheckCircle2 aria-hidden="true" size={18} />
                      <div>
                        <strong>{codexCliStatus.authenticated ? 'Codex CLI authenticated' : 'Codex CLI not ready'}</strong>
                        <p>{codexCliStatus.message}</p>
                      </div>
                    </div>

                    <div className="ai-method-grid">
                      <form.Field name="codexCliModel">
                        {(modelField) => (
                          <label>
                            Codex CLI model
                            <select
                              name={modelField.name}
                              onBlur={modelField.handleBlur}
                              onChange={(event) => {
                                markUnsaved()
                                modelField.handleChange(event.target.value)
                              }}
                              value={modelField.state.value}
                            >
                              {codexCliModelOptions.map((modelId) => (
                                <option key={modelId} value={modelId}>
                                  {modelId}
                                </option>
                              ))}
                            </select>
                            <small className="field-guidance">
                              Available for Local Codex CLI generation.
                            </small>
                            <FieldErrors errors={modelField.state.meta.errors} />
                          </label>
                        )}
                      </form.Field>
                    </div>

                    <ol className="friendly-steps compact">
                      <li>
                        <strong>Install:</strong> run <code>npm install -g @openai/codex</code> or
                        install Codex from the official GitHub releases.
                      </li>
                      <li>
                        <strong>Authorize:</strong> run <code>codex login</code>, choose Sign in
                        with ChatGPT, and finish the browser flow.
                      </li>
                      <li>
                        <strong>Verify:</strong> run <code>codex login status</code>. It should say
                        you are logged in using ChatGPT.
                      </li>
                    </ol>

                    <div className="guide-link-list always-visible">
                      <a href="https://help.openai.com/en/articles/11381614" rel="noreferrer" target="_blank">
                        <ExternalLink aria-hidden="true" size={15} />
                        Codex CLI and Sign in with ChatGPT
                      </a>
                      <a href="https://github.com/openai/codex" rel="noreferrer" target="_blank">
                        <ExternalLink aria-hidden="true" size={15} />
                        OpenAI Codex CLI on GitHub
                      </a>
                    </div>

                    <div className="button-row">
                      <button className="secondary-button" onClick={() => void refreshCodexStatus()} type="button">
                        Check Codex CLI status
                      </button>
                      {modelMessage ? <p className="publish-state">{modelMessage}</p> : null}
                    </div>
                  </div>
                ) : null}

                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </section>

        <section className="template-card settings-section" id="x-publishing">
          <div className="panel-heading">
            <Send aria-hidden="true" size={22} />
            <div>
              <h2>X publishing</h2>
              <p>
                Add a user access token from the X Developer Portal with permission to
                create posts.
              </p>
            </div>
          </div>
          <form.Field name="xAccessToken">
            {(field) => (
              <label>
                X access token
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  placeholder={settings.xConfigured ? 'Configured' : 'Paste access token'}
                  type="password"
                  value={field.state.value}
                />
                <small className="field-guidance">
                  Create an app at{' '}
                  <a href="https://developer.x.com/en/portal/dashboard" rel="noreferrer" target="_blank">
                    X Developer Portal
                  </a>{' '}
                  and generate a user token with write access.
                </small>
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
        </section>

        <section className="template-card settings-section linkedin-settings-section" id="linkedin-publishing">
          <div className="panel-heading">
            <Link2 aria-hidden="true" size={22} />
            <div>
              <h2>LinkedIn publishing</h2>
              <p>
                Choose whether you are posting as yourself or for a company Page, then
                paste the token and author URN from LinkedIn.
              </p>
            </div>
          </div>

          <div className="target-toggle" aria-label="LinkedIn posting target">
            <button
              className={postingTarget === 'person' ? 'selected' : ''}
              onClick={() => setPostingTarget('person')}
              type="button"
            >
              <UserRound aria-hidden="true" size={17} />
              Individual
            </button>
            <button
              className={postingTarget === 'organization' ? 'selected' : ''}
              onClick={() => setPostingTarget('organization')}
              type="button"
            >
              <Building2 aria-hidden="true" size={17} />
              Company Page
            </button>
          </div>

          <div className="setup-callout">
            {postingTarget === 'person' ? (
              <p>
                For an individual profile, create a LinkedIn app, add Share on LinkedIn,
                complete OAuth as yourself, and use an author URN like
                <code>urn:li:person:abc123</code>.
              </p>
            ) : (
              <p>
                For a company Page, confirm your LinkedIn account manages the Page, request
                any required Marketing or Community Management access, and use an author URN
                like <code>urn:li:organization:123456</code>.
              </p>
            )}
          </div>

          <form.Field name="linkedinAccessToken">
            {(field) => (
              <label>
                LinkedIn access token
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  placeholder={settings.linkedinConfigured ? 'Configured' : 'Paste OAuth access token'}
                  type="password"
                  value={field.state.value}
                />
                <small className="field-guidance">
                  This token is created by LinkedIn OAuth after the LinkedIn member grants
                  your app permission to post.
                </small>
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
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  placeholder={postingTarget === 'person' ? 'urn:li:person:abc123' : 'urn:li:organization:123456'}
                  value={field.state.value}
                />
                <small className="field-guidance">
                  Use a person URN for individual posts or an organization URN for company
                  Page posts.
                </small>
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
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  value={field.state.value}
                />
                <small className="field-guidance">
                  Leave this at 202604 unless LinkedIn asks you to use a newer REST API
                  version.
                </small>
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>
        </section>

        <section className="template-card settings-section guide-panel">
          <h2>LinkedIn setup checklist</h2>
          <ol className="friendly-steps">
            <li>
              <strong>Create an app:</strong> open{' '}
              <a href="https://www.linkedin.com/developers/apps" rel="noreferrer" target="_blank">
                LinkedIn Developer Apps
              </a>{' '}
              and create a new app.
            </li>
            <li>
              <strong>Add products:</strong> add Share on LinkedIn for profile posting.
              Add Sign in with LinkedIn if you need profile/email identity.
            </li>
            <li>
              <strong>Company Page:</strong> if posting for a company, confirm your
              LinkedIn member manages the Page and review Marketing API access.
            </li>
            <li>
              <strong>Authorize:</strong> complete LinkedIn OAuth and request posting
              permission such as <code>w_member_social</code>.
            </li>
            <li>
              <strong>Paste here:</strong> save the access token, author URN, and API
              version in this settings form.
            </li>
          </ol>
          <div className="guide-link-list always-visible">
            <a href="https://learn.microsoft.com/linkedin/shared/authentication/getting-access?context=linkedin%2Fcontext" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              Getting access to LinkedIn APIs
            </a>
            <a href="https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              LinkedIn OAuth 2.0
            </a>
            <a href="https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              Share on LinkedIn
            </a>
            <a href="https://learn.microsoft.com/en-us/linkedin/marketing/?view=li-lms-2026-04" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              Marketing API docs
            </a>
          </div>
        </section>

        <div className="settings-submit-row">
          {hasUnsavedChanges ? (
            <div className="unsaved-settings-alert" role="status">
              <span aria-hidden="true" />
              Unsaved changes
            </div>
          ) : null}
          <button type="submit">
            <Save aria-hidden="true" size={17} />
            Save settings
          </button>
          {message ? <p className="publish-state">{message}</p> : null}
        </div>
      </form>
    </AppLayout>
  )
}

function StatusCard({
  configured,
  icon: Icon,
  label,
}: Readonly<{
  configured: boolean
  icon: typeof Bot
  label: string
}>) {
  return (
    <article className="stat-card">
      <div className={configured ? 'stat-icon ready' : 'stat-icon'}>
        <Icon aria-hidden="true" size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{configured ? 'Configured' : 'Missing'}</strong>
      </div>
      {configured ? <CheckCircle2 aria-hidden="true" className="status-check" size={19} /> : null}
    </article>
  )
}

async function getCodexCliStatus() {
  const { spawn } = await import('node:child_process')

  return new Promise<{ installed: boolean; authenticated: boolean; message: string }>((resolve) => {
    const child = spawn('codex', ['login', 'status'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', () => {
      logInfo('codex_cli.status.spawn_error')
      resolve({
        installed: false,
        authenticated: false,
        message: 'Codex CLI is not installed or is not available on PATH.',
      })
    })
    child.on('close', (code) => {
      const output = `${stdout}\n${stderr}`.trim()
      const authenticated = code === 0 && /logged in/i.test(output)
      resolve({
        installed: code !== 127,
        authenticated,
        message: authenticated
          ? output || 'Logged in.'
          : output || 'Run codex login and choose Sign in with ChatGPT.',
      })
      if (!authenticated) {
        logError('codex_cli.status.not_authenticated', new Error(output || 'Not authenticated'), {
          code: code ?? -1,
        })
      }
    })
  })
}

function isUsefulTextModel(id: string) {
  if (
    id.includes('audio') ||
    id.includes('embedding') ||
    id.includes('image') ||
    id.includes('realtime') ||
    id.includes('sora') ||
    id.includes('tts') ||
    id.includes('transcribe') ||
    id.includes('whisper')
  ) {
    return false
  }

  return id.startsWith('gpt-') || id.startsWith('o')
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
