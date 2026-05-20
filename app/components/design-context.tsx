import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ColorScheme = 'ocean-blue' | 'royal-purple' | 'sunset-gradient'
export type LayoutVariant = 'sidebar-left' | 'sidebar-right' | 'top-nav'
export type DesignPreferences = {
  colorScheme: ColorScheme
  layoutVariant: LayoutVariant
  hasPersistedCookie: boolean
}

type DesignContextValue = {
  colorScheme: ColorScheme
  layoutVariant: LayoutVariant
  setColorScheme: (scheme: ColorScheme) => void
  setLayoutVariant: (variant: LayoutVariant) => void
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined)

const colorSchemes = new Set<ColorScheme>(['ocean-blue', 'royal-purple', 'sunset-gradient'])
const layoutVariants = new Set<LayoutVariant>(['sidebar-left', 'sidebar-right', 'top-nav'])
const colorCookieName = 'smd_color_scheme'
const layoutCookieName = 'smd_layout_variant'
const defaultColorScheme: ColorScheme = 'ocean-blue'
const defaultLayoutVariant: LayoutVariant = 'sidebar-left'

export function DesignProvider({
  children,
  initialPreferences,
}: Readonly<{
  children: ReactNode
  initialPreferences?: DesignPreferences
}>) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(
    initialPreferences?.colorScheme ?? defaultColorScheme,
  )
  const [layoutVariant, setLayoutVariantState] = useState<LayoutVariant>(
    initialPreferences?.layoutVariant ?? defaultLayoutVariant,
  )

  useEffect(() => {
    if (initialPreferences?.hasPersistedCookie) return

    const savedColor = window.localStorage.getItem('smd-color-scheme')
    const savedLayout = window.localStorage.getItem('smd-layout-variant')

    if (savedColor && colorSchemes.has(savedColor as ColorScheme)) {
      const scheme = savedColor as ColorScheme
      setColorSchemeState(scheme)
      persistDesignCookie(colorCookieName, scheme)
    }
    if (savedLayout && layoutVariants.has(savedLayout as LayoutVariant)) {
      const variant = savedLayout as LayoutVariant
      setLayoutVariantState(variant)
      persistDesignCookie(layoutCookieName, variant)
    }
  }, [initialPreferences?.hasPersistedCookie])

  const value = useMemo(
    () => ({
      colorScheme,
      layoutVariant,
      setColorScheme: (scheme: ColorScheme) => {
        setColorSchemeState(scheme)
        window.localStorage.setItem('smd-color-scheme', scheme)
        persistDesignCookie(colorCookieName, scheme)
      },
      setLayoutVariant: (variant: LayoutVariant) => {
        setLayoutVariantState(variant)
        window.localStorage.setItem('smd-layout-variant', variant)
        persistDesignCookie(layoutCookieName, variant)
      },
    }),
    [colorScheme, layoutVariant],
  )

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>
}

export function useDesign() {
  const context = useContext(DesignContext)
  if (!context) throw new Error('useDesign must be used within DesignProvider')
  return context
}

export function parseDesignPreferences(cookieHeader: string | undefined): DesignPreferences {
  const cookies = new Map<string, string>()
  for (const part of cookieHeader?.split(/;\s*/) ?? []) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    cookies.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)))
  }

  const savedColor = cookies.get(colorCookieName)
  const savedLayout = cookies.get(layoutCookieName)

  return {
    colorScheme: savedColor && colorSchemes.has(savedColor as ColorScheme)
      ? savedColor as ColorScheme
      : defaultColorScheme,
    layoutVariant: savedLayout && layoutVariants.has(savedLayout as LayoutVariant)
      ? savedLayout as LayoutVariant
      : defaultLayoutVariant,
    hasPersistedCookie: Boolean(savedColor || savedLayout),
  }
}

function persistDesignCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}
