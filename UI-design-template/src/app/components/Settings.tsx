import { Palette, Layout, Check } from 'lucide-react';
import { useDesign } from '../contexts/DesignContext';

const colorSchemes = [
  { id: 'ocean-blue' as const, name: 'Ocean Blue', description: 'Clean slate gray with calming blue accents', preview: 'from-slate-900 to-blue-600' },
  { id: 'royal-purple' as const, name: 'Royal Purple', description: 'Elegant white with sophisticated indigo tones', preview: 'from-white via-indigo-100 to-indigo-600' },
  { id: 'sunset-gradient' as const, name: 'Sunset Gradient', description: 'Vibrant purple-to-pink with playful energy', preview: 'from-purple-600 via-pink-500 to-orange-400' },
];

const layoutVariants = [
  { id: 'sidebar-left' as const, name: 'Left Sidebar', description: 'Classic navigation on the left side' },
  { id: 'top-nav' as const, name: 'Top Navigation', description: 'Horizontal navigation bar at the top' },
  { id: 'sidebar-right' as const, name: 'Right Sidebar', description: 'Navigation positioned on the right' },
];

export function Settings() {
  const { colorScheme, setColorScheme, layoutVariant, setLayoutVariant } = useDesign();

  const getColorStyles = () => {
    switch (colorScheme) {
      case 'ocean-blue':
        return {
          container: 'bg-slate-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-slate-900',
          text: 'text-slate-600',
        };
      case 'royal-purple':
        return {
          container: 'bg-gray-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-gray-900',
          text: 'text-gray-600',
        };
      case 'sunset-gradient':
        return {
          container: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
          card: 'bg-white/80 backdrop-blur-sm border border-white shadow-xl',
          heading: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600',
          text: 'text-gray-700',
        };
    }
  };

  const styles = getColorStyles();

  return (
    <div className={`min-h-full ${styles.container}`}>
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${styles.heading}`}>Settings</h1>
          <p className={styles.text}>Customize your SocialHub experience</p>
        </div>

        {/* Layout Variant Section */}
        <div className={`${styles.card} p-6 rounded-xl mb-8`}>
          <div className="flex items-center gap-3 mb-6">
            <Layout className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className={`text-2xl font-bold ${styles.heading}`}>Layout Style</h2>
              <p className={styles.text}>Choose how you want to navigate the platform</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {layoutVariants.map((layout) => (
              <button
                key={layout.id}
                onClick={() => setLayoutVariant(layout.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  layoutVariant === layout.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-bold ${styles.heading}`}>{layout.name}</h3>
                  {layoutVariant === layout.id && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <p className={`text-sm ${styles.text}`}>{layout.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Color Scheme Section */}
        <div className={`${styles.card} p-6 rounded-xl mb-8`}>
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className={`text-2xl font-bold ${styles.heading}`}>Color Scheme</h2>
              <p className={styles.text}>Select your preferred visual theme</p>
            </div>
          </div>
          <div className="space-y-4">
            {colorSchemes.map((scheme) => (
              <button
                key={scheme.id}
                onClick={() => setColorScheme(scheme.id)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  colorScheme === scheme.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${scheme.preview}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-bold text-lg ${styles.heading}`}>{scheme.name}</h3>
                      {colorScheme === scheme.id && (
                        <Check className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <p className={`text-sm ${styles.text}`}>{scheme.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Other Settings Placeholder */}
        <div className={`${styles.card} p-6 rounded-xl`}>
          <h2 className={`text-2xl font-bold mb-4 ${styles.heading}`}>Account & Security</h2>
          <p className={styles.text}>Profile, email, password, and authentication settings coming soon...</p>
        </div>
      </div>
    </div>
  );
}
