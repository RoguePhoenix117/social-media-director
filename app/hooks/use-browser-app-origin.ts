import { useEffect, useState } from 'react'
import { readBrowserAppOrigin } from '../lib/browser-app-origin'

/**
 * Tracks the normalized browser origin (`127.0.0.1`, not `localhost`) for setup
 * copy and OAuth URL fields.
 */
export function useBrowserAppOrigin(): string | null {
  const [origin, setOrigin] = useState<string | null>(() => readBrowserAppOrigin())

  useEffect(() => {
    setOrigin(readBrowserAppOrigin())
  }, [])

  return origin
}
