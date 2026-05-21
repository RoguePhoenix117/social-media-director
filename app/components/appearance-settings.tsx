import { Activity, Check, Palette } from 'lucide-react'
import { useDesign, type ColorScheme, type LayoutVariant } from './design-context'

const colorSchemes = [
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Clean slate gray with calm blue accents.',
    preview: 'preview-ocean',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    description: 'White surfaces with sophisticated indigo tones.',
    preview: 'preview-purple',
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset Gradient',
    description: 'Vibrant purple-to-pink energy for presentation mode.',
    preview: 'preview-sunset',
  },
] as const

const layoutVariants = [
  {
    id: 'sidebar-left',
    name: 'Left sidebar',
    description: 'Classic navigation on the left side.',
  },
  {
    id: 'top-nav',
    name: 'Top navigation',
    description: 'Horizontal navigation bar at the top.',
  },
  {
    id: 'sidebar-right',
    name: 'Right sidebar',
    description: 'Navigation positioned on the right.',
  },
] as const

export function AppearanceSettings() {
  const { colorScheme, layoutVariant, setColorScheme, setLayoutVariant } = useDesign()

  return (
    <section className="template-card settings-section" id="appearance">
      <div className="panel-heading">
        <Palette aria-hidden="true" size={22} />
        <div>
          <h2>Appearance</h2>
          <p>Layout and color scheme apply immediately across the dashboard.</p>
        </div>
      </div>

      <div className="appearance-subsection">
        <div className="panel-heading compact">
          <Activity aria-hidden="true" size={20} />
          <div>
            <h3>Layout</h3>
            <p>Choose how navigation is positioned.</p>
          </div>
        </div>
        <div className="option-grid">
          {layoutVariants.map((layout) => (
            <button
              className={layoutVariant === layout.id ? 'option-card selected' : 'option-card'}
              key={layout.id}
              onClick={() => setLayoutVariant(layout.id as LayoutVariant)}
              type="button"
            >
              <span>
                <strong>{layout.name}</strong>
                <small>{layout.description}</small>
              </span>
              {layoutVariant === layout.id ? <Check aria-hidden="true" size={18} /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="appearance-subsection">
        <div className="panel-heading compact">
          <Palette aria-hidden="true" size={20} />
          <div>
            <h3>Color scheme</h3>
            <p>Select the visual tone for the dashboard.</p>
          </div>
        </div>
        <div className="scheme-list">
          {colorSchemes.map((scheme) => (
            <button
              className={colorScheme === scheme.id ? 'scheme-option selected' : 'scheme-option'}
              key={scheme.id}
              onClick={() => setColorScheme(scheme.id as ColorScheme)}
              type="button"
            >
              <span className={`scheme-preview ${scheme.preview}`} />
              <span>
                <strong>{scheme.name}</strong>
                <small>{scheme.description}</small>
              </span>
              {colorScheme === scheme.id ? <Check aria-hidden="true" size={18} /> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
