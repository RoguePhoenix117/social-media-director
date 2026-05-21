import { useForm, useStore } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { Bot, CheckCircle2, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  aiBackendLabels,
  aiBackendTypes,
  type AiBackendType,
  isAiBackendType,
} from '../lib/domain/ai-backends'
import type { CodexCliStatus } from '../lib/server/codex-cli'
import type { PublicSettingsStatus } from '../lib/server/settings'
import {
  saveCodexConnection,
  saveOpenAiConnection,
  testCodexConnection,
  testOpenAiConnection,
} from '../server/ai-workspace'

const backendFormSchema = z.object({
  backendType: z.union([z.literal(''), z.enum(aiBackendTypes)]),
  openaiApiKey: z.string(),
  openaiModel: z.string(),
  codexCliModel: z.string(),
})

type AiWorkspaceProps = {
  settings: PublicSettingsStatus
  codexCli: CodexCliStatus | null
  onSaved?: (settings: PublicSettingsStatus) => void | Promise<void>
  onMarkUnsaved?: () => void
  showSaveButton?: boolean
  saveLabel?: string
  compactIntro?: boolean
}

function initialBackendType(settings: PublicSettingsStatus): '' | AiBackendType {
  if (settings.activeAiBackendType) return settings.activeAiBackendType
  if (settings.openaiConfigured) return 'openaiApiKey'
  if (settings.codexReady) return 'codexCli'
  return ''
}

export function AiWorkspace({
  settings,
  codexCli,
  onSaved,
  onMarkUnsaved,
  showSaveButton = true,
  saveLabel = 'Save AI settings',
  compactIntro = false,
}: AiWorkspaceProps) {
  const testOpenAiFn = useServerFn(testOpenAiConnection)
  const testCodexFn = useServerFn(testCodexConnection)
  const saveOpenAiFn = useServerFn(saveOpenAiConnection)
  const saveCodexFn = useServerFn(saveCodexConnection)

  const [openaiModels, setOpenaiModels] = useState<string[]>(
    settings.openaiModel ? [settings.openaiModel] : [],
  )
  const [codexModels, setCodexModels] = useState<string[]>(
    settings.codexCliModel ? [settings.codexCliModel] : [],
  )
  const [openaiTested, setOpenaiTested] = useState(settings.openaiConfigured)
  const [codexTested, setCodexTested] = useState(settings.codexReady)
  const [codexStatus, setCodexStatus] = useState<CodexCliStatus | null>(codexCli)
  const [testError, setTestError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm({
    defaultValues: {
      backendType: initialBackendType(settings),
      openaiApiKey: '',
      openaiModel: settings.openaiModel ?? '',
      codexCliModel: settings.codexCliModel ?? '',
    },
    validators: {
      onChange: backendFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!isAiBackendType(value.backendType)) {
        setTestError('Select an AI backend before saving.')
        return
      }

      setIsSaving(true)
      setTestError(undefined)
      setMessage(undefined)

      try {
        if (value.backendType === 'openaiApiKey') {
          if (!openaiTested) {
            setTestError('Test the API key before saving.')
            return
          }
          const nextSettings = await saveOpenAiFn({
            data: {
              openaiApiKey: value.openaiApiKey || undefined,
              openaiModel: value.openaiModel,
            },
          })
          toast.success('OpenAI settings saved.')
          setMessage('OpenAI settings saved.')
          await onSaved?.(nextSettings)
          form.setFieldValue('openaiApiKey', '')
          return
        }

        if (!codexTested) {
          setTestError('Test the Codex CLI connection before saving.')
          return
        }
        const nextSettings = await saveCodexFn({
          data: { codexCliModel: value.codexCliModel },
        })
        toast.success('Codex CLI settings saved.')
        setMessage('Codex CLI settings saved.')
        await onSaved?.(nextSettings)
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Save failed.')
      } finally {
        setIsSaving(false)
      }
    },
  })

  const backendType = useStore(form.store, (state) => state.values.backendType)

  useEffect(() => {
    if (codexCli) {
      setCodexStatus(codexCli)
      return
    }

    let cancelled = false
    void testCodexFn({ data: {} })
      .then((result) => {
        if (!cancelled) setCodexStatus(result.status)
      })
      .catch(() => {
        if (!cancelled) {
          setCodexStatus({
            installed: false,
            authenticated: false,
            message: 'Codex CLI status is unavailable.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [codexCli, testCodexFn])

  async function runOpenAiTest() {
    setIsTesting(true)
    setTestError(undefined)
    setOpenaiTested(false)
    onMarkUnsaved?.()

    try {
      const result = await testOpenAiFn({
        data: { openaiApiKey: form.state.values.openaiApiKey },
      })
      setOpenaiModels(result.models)
      if (!result.models.includes(form.state.values.openaiModel)) {
        form.setFieldValue('openaiModel', result.models[0] ?? '')
      }
      setOpenaiTested(true)
      toast.success(`OpenAI key valid. ${result.models.length} models loaded.`)
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'OpenAI key test failed.'
      setTestError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  async function runCodexTest() {
    setIsTesting(true)
    setTestError(undefined)
    setCodexTested(false)
    onMarkUnsaved?.()

    try {
      const result = await testCodexFn({ data: {} })
      setCodexStatus(result.status)
      setCodexModels(result.models)
      if (!result.models.includes(form.state.values.codexCliModel)) {
        form.setFieldValue('codexCliModel', result.models[0] ?? '')
      }
      setCodexTested(true)
      toast.success(`Codex CLI connected. ${result.models.length} models loaded.`)
    } catch (caught) {
      const errorMessage =
        caught instanceof Error ? caught.message : 'Codex CLI connection test failed.'
      setTestError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <section className="template-card settings-section ai-workspace-section" id="ai-workspace">
      <div className="panel-heading">
        <Bot aria-hidden="true" size={22} />
        <div>
          <h2>AI workspace</h2>
          <p>
            {compactIntro
              ? 'Choose a backend, test the connection, pick a model, then save.'
              : 'Configure one or more AI backends. Each backend keeps its own model. Use the dashboard control to choose which backend generates drafts.'}
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="backendType">
          {(field) => (
            <label>
              AI backend
              <select
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  const value = event.target.value
                  onMarkUnsaved?.()
                  setTestError(undefined)
                  setMessage(undefined)
                  setOpenaiTested(false)
                  setCodexTested(false)
                  field.handleChange(value as '' | AiBackendType)
                }}
                value={field.state.value}
              >
                <option value="">Select…</option>
                {aiBackendTypes.map((type) => (
                  <option key={type} value={type}>
                    {aiBackendLabels[type]}
                  </option>
                ))}
              </select>
              <FieldErrors errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>

        {backendType === 'openaiApiKey' ? (
          <div className="ai-method-panel">
            <div className="auth-state-card unavailable">
              <ExternalLink aria-hidden="true" size={18} />
              <div>
                <strong>ChatGPT subscription login is separate</strong>
                <p>
                  ChatGPT Plus/Pro/Business subscriptions do not pay for API calls from this app.
                  Use an API key for OpenAI API mode.
                </p>
                <a href="https://help.openai.com/en/articles/9039756" rel="noreferrer" target="_blank">
                  ChatGPT billing vs API billing
                </a>
              </div>
            </div>

            <div className="ai-method-grid">
              <form.Field name="openaiApiKey">
                {(field) => (
                  <label>
                    OpenAI API key
                    <div className="input-with-action">
                      <input
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          onMarkUnsaved?.()
                          setOpenaiTested(false)
                          field.handleChange(event.target.value)
                        }}
                        placeholder={settings.openaiConfigured ? 'Configured — paste to replace' : 'sk-...'}
                        type="password"
                        value={field.state.value}
                      />
                      <button
                        className="secondary-button"
                        disabled={
                          isTesting || (!field.state.value.trim() && !settings.openaiConfigured)
                        }
                        onClick={() => void runOpenAiTest()}
                        type="button"
                      >
                        Test key
                      </button>
                    </div>
                    <small className="field-guidance">
                      Create keys at{' '}
                      <a href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">
                        OpenAI API keys
                      </a>
                      . Test loads available models.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>

              <form.Field name="openaiModel">
                {(field) => (
                  <label>
                    API model
                    <select
                      disabled={!openaiTested || openaiModels.length === 0}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        onMarkUnsaved?.()
                        field.handleChange(event.target.value)
                      }}
                      value={field.state.value}
                    >
                      {!openaiTested ? <option value="">Test key to load models</option> : null}
                      {openaiModels.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </select>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>
            </div>
          </div>
        ) : null}

        {backendType === 'codexCli' ? (
          <div className="ai-method-panel">
            {codexStatus ? (
              <div className={codexStatus.authenticated ? 'auth-state-card connected' : 'auth-state-card'}>
                <CheckCircle2 aria-hidden="true" size={18} />
                <div>
                  <strong>
                    {codexStatus.authenticated ? 'Codex CLI authenticated' : 'Codex CLI not ready'}
                  </strong>
                  <p>{codexStatus.message}</p>
                </div>
              </div>
            ) : (
              <p className="setup-copy">Checking Codex CLI status...</p>
            )}

            <ol className="friendly-steps compact">
              <li>
                <strong>Install:</strong> <code>npm install -g @openai/codex</code>
              </li>
              <li>
                <strong>Authorize:</strong> <code>codex login</code>
              </li>
            </ol>

            <div className="button-row">
              <button
                className="secondary-button"
                disabled={isTesting}
                onClick={() => void runCodexTest()}
                type="button"
              >
                Test connection
              </button>
            </div>

            <div className="ai-method-grid">
              <form.Field name="codexCliModel">
                {(field) => (
                  <label>
                    Codex CLI model
                    <select
                      disabled={!codexTested || codexModels.length === 0}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        onMarkUnsaved?.()
                        field.handleChange(event.target.value)
                      }}
                      value={field.state.value}
                    >
                      {!codexTested ? (
                        <option value="">Test connection to load models</option>
                      ) : null}
                      {codexModels.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </select>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>
            </div>
          </div>
        ) : null}

        {testError ? <p className="error">{testError}</p> : null}
        {message ? <p className="publish-state">{message}</p> : null}

        {showSaveButton && backendType ? (
          <div className="button-row">
            <button disabled={isSaving || isTesting} type="submit">
              {saveLabel}
            </button>
          </div>
        ) : null}
      </form>
    </section>
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
