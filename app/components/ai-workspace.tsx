import { useForm, useStore } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { Bot, CheckCircle2, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  DEFAULT_OPENAI_SOCIAL_MODEL,
  openAiModelOptionLabel,
  pickRecommendedOpenAiModel,
  sortOpenAiModelsForSocialPosts,
} from '../lib/ai/recommended-models'
import {
  aiBackendLabels,
  aiBackendTypes,
  type AiBackendType,
  isAiBackendType,
} from '../lib/domain/ai-backends'
import {
  clearStaleServerFunctionReloadFlag,
  formatServerFunctionError,
  invokeServerFn,
} from '../lib/server-fn-error'
import type { CodexCliStatus } from '../lib/server/codex-cli'
import {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
} from '../lib/server/local-ai-models'
import type { PublicSettingsStatus } from '../lib/server/settings'
import {
  saveCodexConnection,
  saveOllamaConnection,
  saveOpenAiConnection,
  saveOpenAiCompatibleConnection,
  saveTemplateConnection,
  testCodexConnection,
  testOllamaConnection,
  testOpenAiConnection,
  testOpenAiCompatibleConnection,
} from '../server/ai-workspace'

const backendFormSchema = z.object({
  backendType: z.union([z.literal(''), z.enum(aiBackendTypes)]),
  openaiApiKey: z.string(),
  openaiModel: z.string(),
  ollamaHost: z.string(),
  ollamaModel: z.string(),
  openaiCompatibleProviderName: z.string(),
  openaiCompatibleBaseUrl: z.string(),
  openaiCompatibleApiKey: z.string(),
  openaiCompatibleModel: z.string(),
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
  if (settings.templateConfigured) return 'template'
  if (settings.openaiConfigured) return 'openaiApiKey'
  if (settings.ollamaConfigured) return 'ollama'
  if (settings.openaiCompatibleConfigured) return 'openaiCompatible'
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
  const testOllamaFn = useServerFn(testOllamaConnection)
  const testOpenAiCompatibleFn = useServerFn(testOpenAiCompatibleConnection)
  const testCodexFn = useServerFn(testCodexConnection)
  const saveTemplateFn = useServerFn(saveTemplateConnection)
  const saveOpenAiFn = useServerFn(saveOpenAiConnection)
  const saveOllamaFn = useServerFn(saveOllamaConnection)
  const saveOpenAiCompatibleFn = useServerFn(saveOpenAiCompatibleConnection)
  const saveCodexFn = useServerFn(saveCodexConnection)

  const [openaiModels, setOpenaiModels] = useState<string[]>(
    settings.openaiModel ? [settings.openaiModel] : [],
  )
  const [codexModels, setCodexModels] = useState<string[]>(
    settings.codexCliModel ? [settings.codexCliModel] : [],
  )
  const [ollamaModels, setOllamaModels] = useState<string[]>(
    settings.ollamaModel ? [settings.ollamaModel] : [],
  )
  const [openaiCompatibleModels, setOpenaiCompatibleModels] = useState<string[]>(
    settings.openaiCompatibleModel ? [settings.openaiCompatibleModel] : [],
  )
  const [openaiTested, setOpenaiTested] = useState(settings.openaiConfigured)
  const [ollamaTested, setOllamaTested] = useState(settings.ollamaConfigured)
  const [openaiCompatibleTested, setOpenaiCompatibleTested] = useState(
    settings.openaiCompatibleConfigured,
  )
  const [codexTested, setCodexTested] = useState(settings.codexReady)
  const [codexStatus, setCodexStatus] = useState<CodexCliStatus | null>(codexCli)
  const [testError, setTestError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    clearStaleServerFunctionReloadFlag()
  }, [])

  const form = useForm({
    defaultValues: {
      backendType: initialBackendType(settings),
      openaiApiKey: '',
      openaiModel: settings.openaiModel ?? '',
      ollamaHost: settings.ollamaHost ?? DEFAULT_OLLAMA_HOST,
      ollamaModel: settings.ollamaModel ?? '',
      openaiCompatibleProviderName:
        settings.openaiCompatibleProviderName ?? 'LM Studio',
      openaiCompatibleBaseUrl:
        settings.openaiCompatibleBaseUrl ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
      openaiCompatibleApiKey: '',
      openaiCompatibleModel: settings.openaiCompatibleModel ?? '',
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
        if (value.backendType === 'template') {
          const nextSettings = await saveTemplateFn({ data: {} })
          toast.success('Template mode enabled.')
          setMessage('Template mode enabled.')
          await onSaved?.(nextSettings)
          return
        }

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

        if (value.backendType === 'ollama') {
          if (!ollamaTested) {
            setTestError('Test the Ollama connection before saving.')
            return
          }
          const nextSettings = await saveOllamaFn({
            data: {
              ollamaHost: value.ollamaHost,
              ollamaModel: value.ollamaModel,
            },
          })
          toast.success('Ollama settings saved.')
          setMessage('Ollama settings saved.')
          await onSaved?.(nextSettings)
          return
        }

        if (value.backendType === 'openaiCompatible') {
          if (!openaiCompatibleTested) {
            setTestError('Test the OpenAI-compatible connection before saving.')
            return
          }
          const nextSettings = await saveOpenAiCompatibleFn({
            data: {
              providerName: value.openaiCompatibleProviderName,
              baseUrl: value.openaiCompatibleBaseUrl,
              apiKey: value.openaiCompatibleApiKey || undefined,
              model: value.openaiCompatibleModel,
            },
          })
          toast.success('OpenAI-compatible settings saved.')
          setMessage('OpenAI-compatible settings saved.')
          await onSaved?.(nextSettings)
          form.setFieldValue('openaiCompatibleApiKey', '')
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
        setMessage(formatServerFunctionError(caught))
      } finally {
        setIsSaving(false)
      }
    },
  })

  const backendType = useStore(form.store, (state) => state.values.backendType)

  useEffect(() => {
    setCodexStatus(codexCli)
  }, [codexCli])

  async function runOpenAiTest() {
    setIsTesting(true)
    setTestError(undefined)
    setOpenaiTested(false)
    onMarkUnsaved?.()

    try {
      const result = await invokeServerFn(() =>
        testOpenAiFn({
          data: { openaiApiKey: form.state.values.openaiApiKey },
        }),
      )
      const models = sortOpenAiModelsForSocialPosts(result.models)
      setOpenaiModels(models)
      const currentModel = form.state.values.openaiModel
      if (!currentModel || !models.includes(currentModel)) {
        form.setFieldValue('openaiModel', pickRecommendedOpenAiModel(models))
      }
      setOpenaiTested(true)
      const recommended = pickRecommendedOpenAiModel(models)
      toast.success(
        `OpenAI key valid. ${models.length} models loaded — ${recommended} recommended for social posts.`,
      )
    } catch (caught) {
      const errorMessage = formatServerFunctionError(caught)
      setTestError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  async function runOllamaTest() {
    setIsTesting(true)
    setTestError(undefined)
    setOllamaTested(false)
    onMarkUnsaved?.()

    try {
      const result = await invokeServerFn(() =>
        testOllamaFn({ data: { ollamaHost: form.state.values.ollamaHost } }),
      )
      setOllamaModels(result.models)
      form.setFieldValue('ollamaHost', result.host)
      if (!result.models.includes(form.state.values.ollamaModel)) {
        form.setFieldValue('ollamaModel', result.models[0] ?? '')
      }
      setOllamaTested(true)
      toast.success(`Ollama connected. ${result.models.length} local models loaded.`)
    } catch (caught) {
      const errorMessage = formatServerFunctionError(caught)
      setTestError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  async function runOpenAiCompatibleTest() {
    setIsTesting(true)
    setTestError(undefined)
    setOpenaiCompatibleTested(false)
    onMarkUnsaved?.()

    try {
      const result = await invokeServerFn(() =>
        testOpenAiCompatibleFn({
          data: {
            providerName: form.state.values.openaiCompatibleProviderName,
            baseUrl: form.state.values.openaiCompatibleBaseUrl,
            apiKey: form.state.values.openaiCompatibleApiKey || undefined,
          },
        }),
      )
      setOpenaiCompatibleModels(result.models)
      form.setFieldValue('openaiCompatibleProviderName', result.providerName)
      form.setFieldValue('openaiCompatibleBaseUrl', result.baseUrl)
      if (!result.models.includes(form.state.values.openaiCompatibleModel)) {
        form.setFieldValue('openaiCompatibleModel', result.models[0] ?? '')
      }
      setOpenaiCompatibleTested(true)
      toast.success(`${result.providerName} connected. ${result.models.length} models loaded.`)
    } catch (caught) {
      const errorMessage = formatServerFunctionError(caught)
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
      const result = await invokeServerFn(() => testCodexFn({ data: {} }))
      setCodexStatus(result.status)
      setCodexModels(result.models)
      if (!result.models.includes(form.state.values.codexCliModel)) {
        form.setFieldValue('codexCliModel', result.models[0] ?? '')
      }
      setCodexTested(true)
      toast.success(`Codex CLI connected. ${result.models.length} models loaded.`)
    } catch (caught) {
      const errorMessage = formatServerFunctionError(caught)
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
                  setOllamaTested(false)
                  setOpenaiCompatibleTested(false)
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
                          {openAiModelOptionLabel(modelId, openaiModels)}
                        </option>
                      ))}
                    </select>
                    <small className="field-guidance">
                      Social posts are short — pick a mini or nano model for speed and lower cost (
                      {DEFAULT_OPENAI_SOCIAL_MODEL} when available). Reasoning models (o-series)
                      are overkill here.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>
            </div>
          </div>
        ) : null}

        {backendType === 'template' ? (
          <div className="ai-method-panel">
            <div className="auth-state-card connected">
              <CheckCircle2 aria-hidden="true" size={18} />
              <div>
                <strong>No AI key required</strong>
                <p>
                  Template mode creates deterministic review drafts from the imported
                  source. It is useful for demos, offline setup, and fallback workflows,
                  but it is not model-generated copy.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {backendType === 'ollama' ? (
          <div className="ai-method-panel">
            <div className="auth-state-card connected">
              <CheckCircle2 aria-hidden="true" size={18} />
              <div>
                <strong>Local Ollama server</strong>
                <p>
                  Run Ollama locally and pull a model such as <code>llama3.2:3b</code>
                  , <code>qwen3:4b</code>, or another installed text model.
                </p>
              </div>
            </div>

            <div className="ai-method-grid">
              <form.Field name="ollamaHost">
                {(field) => (
                  <label>
                    Ollama host
                    <div className="input-with-action">
                      <input
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          onMarkUnsaved?.()
                          setOllamaTested(false)
                          field.handleChange(event.target.value)
                        }}
                        placeholder={DEFAULT_OLLAMA_HOST}
                        type="url"
                        value={field.state.value}
                      />
                      <button
                        className="secondary-button"
                        disabled={isTesting || !field.state.value.trim()}
                        onClick={() => void runOllamaTest()}
                        type="button"
                      >
                        Test server
                      </button>
                    </div>
                    <small className="field-guidance">
                      Default local endpoint: {DEFAULT_OLLAMA_HOST}. Local models may
                      take longer than hosted APIs.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>

              <form.Field name="ollamaModel">
                {(field) => (
                  <label>
                    Ollama model
                    <select
                      disabled={!ollamaTested || ollamaModels.length === 0}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        onMarkUnsaved?.()
                        field.handleChange(event.target.value)
                      }}
                      value={field.state.value}
                    >
                      {!ollamaTested ? <option value="">Test server to load models</option> : null}
                      {ollamaModels.map((modelId) => (
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

        {backendType === 'openaiCompatible' ? (
          <div className="ai-method-panel">
            <div className="auth-state-card connected">
              <ExternalLink aria-hidden="true" size={18} />
              <div>
                <strong>OpenAI-compatible API</strong>
                <p>
                  Use LM Studio, Ollama&apos;s /v1 endpoint, vLLM, LocalAI, or another
                  server that exposes OpenAI-compatible <code>/models</code> and chat
                  endpoints.
                </p>
              </div>
            </div>

            <div className="ai-method-grid">
              <form.Field name="openaiCompatibleProviderName">
                {(field) => (
                  <label>
                    Provider label
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="LM Studio"
                      value={field.state.value}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>

              <form.Field name="openaiCompatibleBaseUrl">
                {(field) => (
                  <label>
                    Base URL
                    <div className="input-with-action">
                      <input
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          onMarkUnsaved?.()
                          setOpenaiCompatibleTested(false)
                          field.handleChange(event.target.value)
                        }}
                        placeholder={DEFAULT_OPENAI_COMPATIBLE_BASE_URL}
                        type="url"
                        value={field.state.value}
                      />
                      <button
                        className="secondary-button"
                        disabled={isTesting || !field.state.value.trim()}
                        onClick={() => void runOpenAiCompatibleTest()}
                        type="button"
                      >
                        Test server
                      </button>
                    </div>
                    <small className="field-guidance">
                      LM Studio commonly uses {DEFAULT_OPENAI_COMPATIBLE_BASE_URL};
                      Ollama&apos;s compatible endpoint commonly uses http://localhost:11434/v1.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>

              <form.Field name="openaiCompatibleApiKey">
                {(field) => (
                  <label>
                    API key
                    <input
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        onMarkUnsaved?.()
                        field.handleChange(event.target.value)
                      }}
                      placeholder={
                        settings.openaiCompatibleConfigured
                          ? 'Configured — paste to replace'
                          : 'local'
                      }
                      type="password"
                      value={field.state.value}
                    />
                    <small className="field-guidance">
                      Many local servers accept any placeholder key.
                    </small>
                    <FieldErrors errors={field.state.meta.errors} />
                  </label>
                )}
              </form.Field>

              <form.Field name="openaiCompatibleModel">
                {(field) => (
                  <label>
                    Model
                    <select
                      disabled={!openaiCompatibleTested || openaiCompatibleModels.length === 0}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        onMarkUnsaved?.()
                        field.handleChange(event.target.value)
                      }}
                      value={field.state.value}
                    >
                      {!openaiCompatibleTested ? (
                        <option value="">Test server to load models</option>
                      ) : null}
                      {openaiCompatibleModels.map((modelId) => (
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
              <p className="setup-copy">Click Test connection to check Codex CLI status.</p>
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
