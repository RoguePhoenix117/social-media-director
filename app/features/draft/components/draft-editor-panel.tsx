import { CheckCircle2, CircleAlert, RotateCcw } from 'lucide-react'
import type { Provider, ValidationResult } from '../../../lib/domain/providers'
import type { DraftEditorTarget } from './draft-channel-picker'

const characterLimits: Record<Provider, number> = {
  x: 280,
  linkedin: 3000,
}

type DraftEditorPanelProps = {
  activeTarget: DraftEditorTarget
  text: string
  validation: ValidationResult
  onTextChange: (text: string) => void
  onBackToGlobal: () => void
}

export function DraftEditorPanel({
  activeTarget,
  text,
  validation,
  onTextChange,
  onBackToGlobal,
}: Readonly<DraftEditorPanelProps>) {
  const limit =
    activeTarget === 'global' ? Math.max(...Object.values(characterLimits)) : characterLimits[activeTarget]
  const editingLabel =
    activeTarget === 'global'
      ? 'Global copy (updates every selected channel)'
      : `Editing ${providerLabel(activeTarget)}`

  return (
    <div className="draft-editor-panel">
      <div className="draft-editor-meta">
        <span className="draft-editor-mode">
          <span aria-hidden="true" className="draft-editor-mode-dot" />
          {editingLabel}
        </span>
        {activeTarget !== 'global' ? (
          <button className="draft-back-global" onClick={onBackToGlobal} type="button">
            <RotateCcw aria-hidden="true" size={14} />
            Back to global
          </button>
        ) : null}
      </div>
      <textarea
        className="draft-editor-textarea"
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={
          activeTarget === 'global'
            ? 'Write copy that applies to every channel, then fine-tune per network.'
            : `Tailor this post for ${providerLabel(activeTarget)}.`
        }
        rows={activeTarget === 'x' ? 8 : 12}
        value={text}
      />
      <div className="draft-editor-footer">
        <span className={`draft-char-count ${validation.status}`}>
          {validation.status === 'valid' ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : (
            <CircleAlert aria-hidden="true" size={14} />
          )}
          {text.length}/{limit}
        </span>
      </div>
      {validation.messages.length ? (
        <ul className="validation-list">
          {validation.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function providerLabel(provider: Provider) {
  return provider === 'x' ? 'X' : 'LinkedIn'
}
