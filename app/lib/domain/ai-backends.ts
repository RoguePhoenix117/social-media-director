export const aiBackendTypes = [
  'template',
  'openaiApiKey',
  'ollama',
  'openaiCompatible',
  'codexCli',
] as const

export type AiBackendType = (typeof aiBackendTypes)[number]

export const aiBackendLabels: Record<AiBackendType, string> = {
  template: 'Template mode',
  openaiApiKey: 'OpenAI API',
  ollama: 'Ollama local',
  openaiCompatible: 'OpenAI-compatible',
  codexCli: 'Local Codex CLI',
}

export function isAiBackendType(value: string): value is AiBackendType {
  return (aiBackendTypes as readonly string[]).includes(value)
}
