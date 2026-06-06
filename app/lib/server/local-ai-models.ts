const localModelTimeoutMs = 5_000

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434'
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'http://localhost:1234/v1'
export const DEFAULT_OPENAI_COMPATIBLE_API_KEY = 'local'

export async function listOllamaModels(host = DEFAULT_OLLAMA_HOST) {
  const baseUrl = normalizeBaseUrl(host)
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(localModelTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Ollama did not respond: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as {
    models?: Array<{ name?: string; model?: string }>
  }
  const models = (payload.models ?? [])
    .map((model) => model.name ?? model.model)
    .filter((model): model is string => Boolean(model))
    .sort((left, right) => left.localeCompare(right))

  if (!models.length) {
    throw new Error('Ollama is running, but no local models are installed.')
  }

  return models
}

export async function listOpenAiCompatibleModels(input: {
  baseUrl: string
  apiKey?: string
}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      authorization: `Bearer ${input.apiKey?.trim() || DEFAULT_OPENAI_COMPATIBLE_API_KEY}`,
    },
    signal: AbortSignal.timeout(localModelTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI-compatible server did not respond: ${response.status} ${response.statusText}`,
    )
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> }
  const models = (payload.data ?? [])
    .map((model) => model.id)
    .filter((model): model is string => Boolean(model))
    .sort((left, right) => left.localeCompare(right))

  if (!models.length) {
    throw new Error('The OpenAI-compatible server returned no models.')
  }

  return models
}

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('Enter a base URL.')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid absolute URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.')
  }

  return url.toString().replace(/\/+$/, '')
}
