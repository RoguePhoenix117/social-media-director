import { createContext, useContext, useState, ReactNode } from 'react';

type ColorScheme = 'ocean-blue' | 'royal-purple' | 'sunset-gradient';
type LayoutVariant = 'sidebar-left' | 'sidebar-right' | 'top-nav';

interface DesignContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  layoutVariant: LayoutVariant;
  setLayoutVariant: (layout: LayoutVariant) => void;
}

const DesignContext = createContext<DesignContextType | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('ocean-blue');
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>('sidebar-left');

  return (
    <DesignContext.Provider value={{ colorScheme, setColorScheme, layoutVariant, setLayoutVariant }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const context = useContext(DesignContext);
  if (!context) {
    throw new Error('useDesign must be used within DesignProvider');
  }
  return context;
}
