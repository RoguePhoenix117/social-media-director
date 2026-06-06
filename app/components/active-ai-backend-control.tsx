import { useServerFn } from '@tanstack/react-start'
import { Bot } from 'lucide-react'
import { aiBackendLabels, type AiBackendType } from '../lib/domain/ai-backends'
import type { PublicSettingsStatus } from '../lib/server/settings'
import { setActiveAiBackendSelection } from '../server/ai-workspace'

type ActiveAiBackendControlProps = {
  settings: PublicSettingsStatus
  onChange: (settings: PublicSettingsStatus) => void
}

export function ActiveAiBackendControl({ settings, onChange }: ActiveAiBackendControlProps) {
  const setActiveFn = useServerFn(setActiveAiBackendSelection)
  const options = settings.configuredAiBackendTypes

  if (!options.length) {
    return (
      <div className="active-backend-control empty">
        <Bot aria-hidden="true" size={18} />
        <p>
          No AI backend is ready yet. Configure one in{' '}
          <a href="/settings#ai-workspace">Settings → AI workspace</a>.
        </p>
      </div>
    )
  }

  return (
    <label className="active-backend-control">
      <span>
        <Bot aria-hidden="true" size={18} />
        Generate with
      </span>
      <select
        onChange={async (event) => {
          const value = event.target.value as AiBackendType
          const nextSettings = await setActiveFn({ data: { backendType: value } })
          onChange(nextSettings)
        }}
        value={settings.activeAiBackendType ?? options[0]}
      >
        {options.map((type) => (
          <option key={type} value={type}>
            {aiBackendLabels[type]}
            {type === 'template' ? ' · deterministic' : ''}
            {type === 'openaiApiKey' && settings.openaiModel ? ` · ${settings.openaiModel}` : ''}
            {type === 'ollama' && settings.ollamaModel ? ` · ${settings.ollamaModel}` : ''}
            {type === 'openaiCompatible' && settings.openaiCompatibleModel
              ? ` · ${settings.openaiCompatibleModel}`
              : ''}
            {type === 'codexCli' && settings.codexCliModel ? ` · ${settings.codexCliModel}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
