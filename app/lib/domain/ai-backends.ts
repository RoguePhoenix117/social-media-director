export const aiBackendTypes = ['openaiApiKey', 'codexCli'] as const

export type AiBackendType = (typeof aiBackendTypes)[number]

export const aiBackendLabels: Record<AiBackendType, string> = {
  openaiApiKey: 'OpenAI API',
  codexCli: 'Local Codex CLI',
}

export function isAiBackendType(value: string): value is AiBackendType {
  return (aiBackendTypes as readonly string[]).includes(value)
}
