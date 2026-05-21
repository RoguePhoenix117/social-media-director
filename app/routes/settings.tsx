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
import { AiWorkspace } from '../components/ai-workspace'
import { AppearanceSettings } from '../components/appearance-settings'
import { AppLayout } from '../components/app-layout'
import { XApiGuide, XCredentialMappingTable } from '../components/x-api-guide'
import { bootstrapQueryKey } from '../lib/bootstrap-query'
import { getCodexCliStatus } from '../lib/server/codex-cli'
import { requireOperatorSession } from '../lib/server/session'
import { getPublicSettingsStatus, saveAppSettings } from '../lib/server/settings'

const settingsInputSchema = z.object({
  xAccessToken: z.string().optional(),
  xRefreshToken: z.string().optional(),
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})

const settingsFormSchema = z.object({
  xAccessToken: z.string(),
  xRefreshToken: z.string(),
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string().min(1, 'Enter a LinkedIn REST API version.'),
})

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
  const [message, setMessage] = useState<string>()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const settings = pageState.settings
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
      xAccessToken: '',
      xRefreshToken: '',
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
            xAccessToken: value.xAccessToken || undefined,
            xRefreshToken: value.xRefreshToken || undefined,
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
        form.setFieldValue('xAccessToken', '')
        form.setFieldValue('xRefreshToken', '')
        form.setFieldValue('linkedinAccessToken', '')
        setMessage('Settings saved. Secret fields were cleared from the screen after saving.')
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Settings failed to save.')
      }
    },
  })

  return (
    <AppLayout operatorName={operatorName}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Configuration and appearance</h1>
          <p className="page-summary">
            Manage AI generation, X and LinkedIn publishing credentials, and dashboard
            layout and colors. Credentials are encrypted in your local database.
          </p>
        </div>
      </header>

      <section className="stats-grid settings-status-grid" aria-label="Configuration status">
        <StatusCard configured={settings.modelConfigured} icon={Bot} label="AI model" />
        <StatusCard configured={settings.xConfigured} icon={Send} label="X publishing" />
        <StatusCard configured={settings.linkedinConfigured} icon={Link2} label="LinkedIn" />
      </section>

      <div className="settings-page-grid">
        <AiWorkspace
          codexCli={pageState.codexCli}
          onSaved={async (nextSettings) => {
            queryClient.setQueryData(settingsPageQueryKey, {
              ...pageState,
              settings: nextSettings,
            })
            await queryClient.invalidateQueries({
              queryKey: settingsPageQueryKey,
              refetchType: 'all',
            })
            await queryClient.invalidateQueries({
              queryKey: bootstrapQueryKey,
              refetchType: 'all',
            })
          }}
          settings={settings}
        />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <section className="template-card settings-section" id="x-publishing">
          <div className="panel-heading">
            <Send aria-hidden="true" size={22} />
            <div>
              <h2>X publishing</h2>
              <p>
                Paste an OAuth 2.0 <strong>user</strong> access token from the X Developer
                Portal. API Key, API Key Secret, and the app-only Bearer Token on the main
                keys screen are not used for posting.
              </p>
            </div>
          </div>

          <div className="settings-form-guide">
            <XApiGuide />
          </div>

          <XCredentialMappingTable />

          <form.Field name="xAccessToken">
            {(field) => (
              <label>
                X user access token (OAuth 2.0)
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  placeholder={
                    settings.xConfigured
                      ? 'Configured — paste to replace'
                      : 'Paste user Access Token from Authentication Tokens'
                  }
                  type="password"
                  value={field.state.value}
                />
                <small className="field-guidance">
                  In{' '}
                  <a href="https://developer.x.com/en/portal/dashboard" rel="noreferrer" target="_blank">
                    developer.x.com
                  </a>
                  , open your App → <strong>Keys and tokens</strong> → scroll to{' '}
                  <strong>Authentication Tokens</strong> → <strong>Access Token and Secret</strong>{' '}
                  → Generate. Use that Access Token here—not Consumer Key, Secret, or the
                  Bearer Token at the top of the page.
                </small>
                <FieldErrors errors={field.state.meta.errors} />
              </label>
            )}
          </form.Field>

          <form.Field name="xRefreshToken">
            {(field) => (
              <label>
                X refresh token (OAuth 2.0, optional)
                <input
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    markUnsaved()
                    field.handleChange(event.target.value)
                  }}
                  placeholder={
                    settings.xRefreshConfigured
                      ? 'Configured — paste to replace'
                      : 'Paste refresh token if you enabled offline.access'
                  }
                  type="password"
                  value={field.state.value}
                />
                <small className="field-guidance">
                  Shown once when you generate a token with <strong>Include refresh token</strong>{' '}
                  (<code>offline.access</code>). Stored encrypted for future automatic renewal;
                  publishing still uses the access token above.
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
          <h2>X setup checklist</h2>
          <ol className="friendly-steps">
            <li>
              <strong>Portal:</strong> sign in at{' '}
              <a href="https://developer.x.com/en/portal/dashboard" rel="noreferrer" target="_blank">
                developer.x.com
              </a>{' '}
              (same as console.x.com) and create a Project with an App.
            </li>
            <li>
              <strong>Authentication settings:</strong> choose Read and write, Type of App →
              Web App, Automated App or Bot, and fill required Callback URI and Website URL
              (e.g. <code>http://127.0.0.1:5173/</code>) before Save Changes will work.
            </li>
            <li>
              <strong>Ignore for this field:</strong> API Key (Consumer Key), API Key Secret,
              and the app-only Bearer Token on the main Keys and tokens tab.
            </li>
            <li>
              <strong>Generate:</strong> under Authentication Tokens → Access Token and
              Secret → Generate, then copy the <strong>Access Token</strong>.
            </li>
            <li>
              <strong>Paste here:</strong> access token in X user access token; refresh token
              (if generated) in X refresh token; then publish a test draft.
            </li>
          </ol>
          <div className="guide-link-list always-visible">
            <a href="https://docs.x.com/fundamentals/authentication/oauth-2-0/overview" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              X OAuth 2.0
            </a>
            <a href="https://docs.x.com/x-api/posts/create-post" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={15} />
              Create Post API
            </a>
          </div>
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
      </div>

      <AppearanceSettings />
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
