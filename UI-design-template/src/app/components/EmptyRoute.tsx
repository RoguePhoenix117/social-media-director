import { useLocation, Link } from 'react-router';
import { Construction } from 'lucide-react';
import { useDesign } from '../contexts/DesignContext';

export function EmptyRoute() {
  const location = useLocation();
  const { colorScheme } = useDesign();

  const routeName = location.pathname.substring(1);
  const displayName = routeName.charAt(0).toUpperCase() + routeName.slice(1);

  const getColorStyles = () => {
    switch (colorScheme) {
      case 'ocean-blue':
        return {
          container: 'bg-slate-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-slate-900',
          text: 'text-slate-600',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
      case 'royal-purple':
        return {
          container: 'bg-gray-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-gray-900',
          text: 'text-gray-600',
          button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
      case 'sunset-gradient':
        return {
          container: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
          card: 'bg-white/80 backdrop-blur-sm border border-white shadow-xl',
          heading: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600',
          text: 'text-gray-700',
          button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white',
        };
    }
  };

  const styles = getColorStyles();

  return (
    <div className={`min-h-full flex items-center justify-center ${styles.container}`}>
      <div className={`${styles.card} p-12 rounded-xl max-w-md text-center`}>
        <Construction className={`w-16 h-16 mx-auto mb-6 ${
          colorScheme === 'ocean-blue' ? 'text-blue-600' :
          colorScheme === 'royal-purple' ? 'text-indigo-600' :
          'text-purple-600'
        }`} />
        <h1 className={`text-3xl font-bold mb-3 ${styles.heading}`}>{displayName}</h1>
        <p className={`mb-8 ${styles.text}`}>
          This feature is coming soon. We're working hard to bring you the best social media management experience.
        </p>
        <Link to="/" className={`inline-block px-6 py-3 rounded-lg font-medium transition-colors ${styles.button}`}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
