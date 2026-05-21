import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { importFormSchema } from '../../lib/dashboard-schemas'
import type { ProviderVariant } from '../../lib/domain/providers'
import { validateProviderPayload } from '../../lib/domain/validation'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import { importAndGenerate, publishVariant, type ImportResult } from '../../server/dashboard'
import { PlatformIcon } from '../../components/platform-icons'

/**
 * Self-contained import + AI generation + per-variant publish workspace.
 * Owns its own React state (result, variants, publish status). Receives
 * `settings` to render the right "Generating with X" status copy.
 */
export function ImportWorkspace({
  settings,
}: Readonly<{
  settings: PublicSettingsStatus | null
}>) {
  const importAndGenerateFn = useServerFn(importAndGenerate)
  const publishVariantFn = useServerFn(publishVariant)

  const [result, setResult] = useState<ImportResult | undefined>()
  const [variants, setVariants] = useState<ProviderVariant[]>([])
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string>()
  const [publishState, setPublishState] = useState<Record<string, string>>({})

  const importForm = useForm({
    defaultValues: { url: '', intentPrompt: '' },
    validators: { onChange: importFormSchema },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      setError(undefined)
      setGenerationStatus('Importing the source URL...')
      try {
        const providerLabel = pickProviderLabel(settings)
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

  async function onPublish(variant: ProviderVariant) {
    setPublishState((current) => ({ ...current, [variant.provider]: 'Publishing...' }))
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

  return (
    <>
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
                    <h2>{providerLabel(variant.provider)}</h2>
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
    </>
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
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Invalid value.'
}

function providerLabel(provider: ProviderVariant['provider']) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}

function pickProviderLabel(settings: PublicSettingsStatus | null): string {
  const active = settings?.activeAiBackendType
  if (active === 'codexCli') return 'Codex CLI'
  if (active === 'openaiApiKey') return 'OpenAI API'
  if (settings?.modelConfigured) return 'configured AI'
  return 'fallback templates'
}
