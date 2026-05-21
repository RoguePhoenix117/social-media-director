/**
 * Setup Mode security helpers.
 *
 * On localhost we let developers complete Setup Mode without a key (DX);
 * everywhere else we require the `INSTANCE_SETUP_KEY` env var to match a
 * `setup_key` query/header to prevent random visitors from hijacking an
 * unconfigured production deployment.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function isLocalhostOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  try {
    const url = new URL(origin)
    const hostname = url.hostname.replace(/^\[(.*)\]$/, '$1')
    return LOCAL_HOSTNAMES.has(hostname)
  } catch {
    return false
  }
}

export type SetupKeyAssertion = {
  required: boolean
  valid: boolean
}

/**
 * Throws when a setup key is required (non-localhost origin with
 * `INSTANCE_SETUP_KEY` set) and the provided key does not match.
 */
export function assertSetupKeyValid(input: {
  origin: string | null | undefined
  providedKey: string | null | undefined
}): SetupKeyAssertion {
  const configuredKey = process.env.INSTANCE_SETUP_KEY?.trim()
  const local = isLocalhostOrigin(input.origin)

  if (local || !configuredKey) {
    return { required: false, valid: true }
  }

  const provided = input.providedKey?.trim() ?? ''
  if (!provided || provided !== configuredKey) {
    throw new Error('A valid INSTANCE_SETUP_KEY is required to access setup on this host.')
  }

  return { required: true, valid: true }
}

export function isSetupKeyConfigured(): boolean {
  return Boolean(process.env.INSTANCE_SETUP_KEY?.trim())
}
