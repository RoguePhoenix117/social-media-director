import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ColorScheme = 'ocean-blue' | 'royal-purple' | 'sunset-gradient'
export type LayoutVariant = 'sidebar-left' | 'sidebar-right' | 'top-nav'

type DesignContextValue = {
  colorScheme: ColorScheme
  layoutVariant: LayoutVariant
  setColorScheme: (scheme: ColorScheme) => void
  setLayoutVariant: (variant: LayoutVariant) => void
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined)

const colorSchemes = new Set<ColorScheme>(['ocean-blue', 'royal-purple', 'sunset-gradient'])
const layoutVariants = new Set<LayoutVariant>(['sidebar-left', 'sidebar-right', 'top-nav'])

export function DesignProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('ocean-blue')
  const [layoutVariant, setLayoutVariantState] = useState<LayoutVariant>('sidebar-left')

  useEffect(() => {
    const savedColor = window.localStorage.getItem('smd-color-scheme')
    const savedLayout = window.localStorage.getItem('smd-layout-variant')

    if (savedColor && colorSchemes.has(savedColor as ColorScheme)) {
      setColorSchemeState(savedColor as ColorScheme)
    }
    if (savedLayout && layoutVariants.has(savedLayout as LayoutVariant)) {
      setLayoutVariantState(savedLayout as LayoutVariant)
    }
  }, [])

  const value = useMemo(
    () => ({
      colorScheme,
      layoutVariant,
      setColorScheme: (scheme: ColorScheme) => {
        setColorSchemeState(scheme)
        window.localStorage.setItem('smd-color-scheme', scheme)
      },
      setLayoutVariant: (variant: LayoutVariant) => {
        setLayoutVariantState(variant)
        window.localStorage.setItem('smd-layout-variant', variant)
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
