import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DraftDetail } from '../../lib/db/draft-types'
import { validateProviderPayload } from '../../lib/domain/validation'
import type { PublicSettingsStatus } from '../../lib/server/settings'
import type { PublicProjectChannel } from '../../lib/server/provider-accounts'
import {
  importAndGenerate,
  loadDraft,
  markDraftReady,
  saveVariantEdits,
  type ImportResult,
} from '../../server/drafts'
import { DraftChannelPicker, type DraftEditorTarget } from './components/draft-channel-picker'
import { DraftComposerLayout } from './components/draft-composer-layout'
import { DraftEditorPanel } from './components/draft-editor-panel'
import { DraftImportForm } from './components/draft-import-form'
import { DraftPreviewColumn } from './components/draft-preview-column'
import { SourceLinkCard } from './components/source-link-card'

type DraftWorkspaceProps = {
  masterPostId: string | null
  settings: PublicSettingsStatus | null
  connectedChannels: PublicProjectChannel[]
  onDraftSaved: (masterPostId: string) => void
  onMarkedReady: () => void
}

export function DraftWorkspace({
  masterPostId,
  settings,
  connectedChannels,
  onDraftSaved,
  onMarkedReady,
}: Readonly<DraftWorkspaceProps>) {
  const importAndGenerateFn = useServerFn(importAndGenerate)
  const loadDraftFn = useServerFn(loadDraft)
  const saveVariantEditsFn = useServerFn(saveVariantEdits)
  const markDraftReadyServerFn = useServerFn(markDraftReady)

  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | undefined>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string>()
  const [saveStatus, setSaveStatus] = useState<string>()
  const [markReadyStatus, setMarkReadyStatus] = useState<string>()
  const [activeTarget, setActiveTarget] = useState<DraftEditorTarget>('global')
  const [globalText, setGlobalText] = useState('')

  const connectedProviders = connectedChannels.map((channel) => channel.provider)

  useEffect(() => {
    if (!masterPostId) {
      setDraft(null)
      setGlobalText('')
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(undefined)
    void loadDraftFn({ data: { masterPostId } })
      .then((result) => {
        if (!cancelled) {
          setDraft(result.draft)
          setGlobalText(deriveGlobalText(result.draft.variants))
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Failed to load draft.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadDraftFn, masterPostId])

  async function onImportSubmit(value: { url: string; intentPrompt: string }) {
    if (!connectedProviders.length) {
      setError('Connect at least one channel in Settings before generating drafts.')
      return
    }

    setIsLoading(true)
    setError(undefined)
    setGenerationStatus('Importing the source URL...')
    try {
      const providerLabel = pickProviderLabel(settings)
      setGenerationStatus(`Generating drafts with ${providerLabel}. This can take a minute.`)
      const nextResult = await importAndGenerateFn({
        data: { url: value.url, intentPrompt: value.intentPrompt || undefined },
      })
      setImportResult(nextResult)
      setGenerationStatus(`Generated ${nextResult.variants.length} platform drafts.`)
      onDraftSaved(nextResult.masterPostId)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Import failed.'
      setError(message)
      setGenerationStatus(`Generation failed: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const variants = useMemo(
    () =>
      (draft?.variants ?? []).filter((variant) =>
        connectedProviders.includes(variant.provider),
      ),
    [connectedProviders, draft?.variants],
  )
  const sourcePreview = draft?.source ?? importResult?.source

  const editorText = useMemo(() => {
    if (activeTarget === 'global') return globalText
    return variants.find((variant) => variant.provider === activeTarget)?.text ?? ''
  }, [activeTarget, globalText, variants])

  const editorValidation = useMemo(() => {
    if (activeTarget === 'global') {
      if (!variants.length) return { status: 'valid' as const, messages: [] }
      const results = variants.map((variant) =>
        validateProviderPayload(variant.provider, {
          text: globalText,
          linkUrl: variant.linkUrl ?? undefined,
          imageUrl: variant.imageUrl ?? undefined,
        }),
      )
      const invalid = results.find((result) => result.status !== 'valid')
      if (invalid) return invalid
      return { status: 'valid' as const, messages: [] }
    }
    const variant = variants.find((row) => row.provider === activeTarget)
    if (!variant) return { status: 'valid' as const, messages: [] }
    return validateProviderPayload(variant.provider, {
      text: variant.text,
      linkUrl: variant.linkUrl ?? undefined,
      imageUrl: variant.imageUrl ?? undefined,
    })
  }, [activeTarget, globalText, variants])

  const canMarkReady =
    draft &&
    draft.status !== 'published' &&
    connectedProviders.length > 0 &&
    connectedProviders.every((provider) => {
      const variant = variants.find((row) => row.provider === provider)
      if (!variant) return false
      return (
        validateProviderPayload(provider, {
          text: variant.text,
          linkUrl: variant.linkUrl ?? undefined,
          imageUrl: variant.imageUrl ?? undefined,
        }).status === 'valid'
      )
    })

  function onEditorTextChange(nextText: string) {
    if (!draft) return
    if (activeTarget === 'global') {
      setGlobalText(nextText)
      setDraft({
        ...draft,
        variants: draft.variants.map((variant) => ({ ...variant, text: nextText })),
      })
      return
    }
    setDraft({
      ...draft,
      variants: draft.variants.map((variant) =>
        variant.provider === activeTarget ? { ...variant, text: nextText } : variant,
      ),
    })
  }

  async function onSaveEdits() {
    if (!draft) return
    setSaveStatus('Saving...')
    try {
      const result = await saveVariantEditsFn({
        data: {
          masterPostId: draft.id,
          variants: draft.variants.map((variant) => ({ id: variant.id, text: variant.text })),
        },
      })
      setDraft(result.draft)
      setGlobalText(deriveGlobalText(result.draft.variants))
      setSaveStatus('Saved.')
    } catch (caught) {
      setSaveStatus(caught instanceof Error ? caught.message : 'Save failed.')
    }
  }

  async function onMarkReady() {
    if (!draft) return
    setMarkReadyStatus('Updating...')
    try {
      const result = await markDraftReadyServerFn({ data: { masterPostId: draft.id } })
      setDraft(result.draft)
      setMarkReadyStatus('Marked ready — open Post to publish or schedule.')
      onMarkedReady()
    } catch (caught) {
      setMarkReadyStatus(caught instanceof Error ? caught.message : 'Could not mark ready.')
    }
  }

  if (masterPostId && isLoading && !draft) {
    return <p className="empty">Loading draft...</p>
  }

  const showComposer = Boolean(masterPostId && draft)
  const showImport = !masterPostId

  return (
    <>
      {masterPostId ? (
        <div className="draft-workspace-toolbar">
          <Link className="text-link" to="/draft">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to drafts
          </Link>
          {draft ? <span className={`status-pill ${draft.status}`}>{draft.status}</span> : null}
        </div>
      ) : null}

      <DraftComposerLayout
        editor={
          <>
            <header className="draft-composer-heading">
              <h2>{showComposer ? 'Edit draft' : 'New draft'}</h2>
              <p>
                {showComposer
                  ? 'Pick a channel to fine-tune copy, or edit globally for every network.'
                  : 'Import a URL and generate platform-specific drafts on this page.'}
              </p>
            </header>

            {showImport ? (
              <DraftImportForm
                disableSubmit={connectedProviders.length === 0}
                error={
                  error ??
                  (connectedProviders.length === 0
                    ? 'Connect at least one channel in Settings before generating drafts.'
                    : undefined)
                }
                generationStatus={generationStatus}
                isLoading={isLoading}
                onSubmit={onImportSubmit}
              />
            ) : null}

            {showComposer ? (
              <>
                <DraftChannelPicker
                  activeTarget={activeTarget}
                  channels={connectedChannels}
                  onSelect={setActiveTarget}
                  variantProviders={variants.map((variant) => variant.provider)}
                />
                <DraftEditorPanel
                  activeTarget={activeTarget}
                  onBackToGlobal={() => {
                    if (draft) setGlobalText(deriveGlobalText(draft.variants))
                    setActiveTarget('global')
                  }}
                  onTextChange={onEditorTextChange}
                  text={editorText}
                  validation={editorValidation}
                />
                {sourcePreview ? (
                  <SourceLinkCard
                    canonicalUrl={
                      'canonicalUrl' in sourcePreview ? sourcePreview.canonicalUrl : undefined
                    }
                    excerpt={'excerpt' in sourcePreview ? sourcePreview.excerpt : undefined}
                    imageUrl={sourcePreview.imageUrl}
                    sourceUrl={'sourceUrl' in sourcePreview ? sourcePreview.sourceUrl : undefined}
                    title={sourcePreview.title}
                  />
                ) : null}
                {draft && draft.status !== 'published' ? (
                  <section className="draft-actions-bar">
                    <button onClick={() => void onSaveEdits()} type="button">
                      Save edits
                    </button>
                    <button
                      disabled={!canMarkReady || draft.status === 'ready'}
                      onClick={() => void onMarkReady()}
                      type="button"
                    >
                      {draft.status === 'ready' ? 'Ready for Post' : 'Mark ready'}
                    </button>
                    {draft.status === 'ready' ? (
                      <Link className="button-link" to="/post">
                        Open Post calendar
                      </Link>
                    ) : null}
                    {saveStatus ? <p className="generation-status">{saveStatus}</p> : null}
                    {markReadyStatus ? <p className="generation-status">{markReadyStatus}</p> : null}
                    {!connectedProviders.length ? (
                      <p className="error">Connect a channel in Settings before marking ready.</p>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        }
        preview={
          showComposer ? (
            <DraftPreviewColumn
              channels={connectedChannels}
              sourceTitle={sourcePreview?.title}
              variants={variants}
            />
          ) : (
            <DraftPreviewColumn channels={connectedChannels} variants={[]} />
          )
        }
      />
    </>
  )
}

function deriveGlobalText(variants: DraftDetail['variants']) {
  if (!variants.length) return ''
  const first = variants[0].text
  return variants.every((variant) => variant.text === first) ? first : first
}

function pickProviderLabel(settings: PublicSettingsStatus | null): string {
  const active = settings?.activeAiBackendType
  if (active === 'template') return 'Template mode'
  if (active === 'ollama') return 'Ollama'
  if (active === 'openaiCompatible') {
    return settings?.openaiCompatibleProviderName ?? 'OpenAI-compatible server'
  }
  if (active === 'codexCli') return 'Codex CLI'
  if (active === 'openaiApiKey') return 'OpenAI API'
  if (settings?.modelConfigured) return 'configured AI'
  return 'fallback templates'
}
