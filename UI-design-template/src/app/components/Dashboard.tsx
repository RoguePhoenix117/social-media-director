import { Link } from 'react-router';
import { TrendingUp, Users, Heart, MessageCircle, Eye } from 'lucide-react';
import { useDesign } from '../contexts/DesignContext';

const stats = [
  { label: 'Total Followers', value: '24.5K', change: '+12%', icon: Users, color: 'blue' },
  { label: 'Engagement Rate', value: '8.2%', change: '+3.1%', icon: Heart, color: 'pink' },
  { label: 'Total Impressions', value: '156K', change: '+18%', icon: Eye, color: 'purple' },
  { label: 'Comments', value: '1,247', change: '+22%', icon: MessageCircle, color: 'green' },
];

const recentPosts = [
  { platform: 'Twitter', content: 'Just launched our new feature...', engagement: '2.4K', time: '2h ago' },
  { platform: 'LinkedIn', content: 'Excited to announce...', engagement: '856', time: '5h ago' },
  { platform: 'Instagram', content: 'Behind the scenes...', engagement: '3.1K', time: '1d ago' },
];

export function Dashboard() {
  const { colorScheme } = useDesign();

  const getColorStyles = () => {
    switch (colorScheme) {
      case 'ocean-blue':
        return {
          container: 'bg-slate-50',
          card: 'bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow',
          heading: 'text-slate-900',
          text: 'text-slate-600',
          statCard: 'bg-gradient-to-br',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
      case 'royal-purple':
        return {
          container: 'bg-gray-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-gray-900',
          text: 'text-gray-600',
          statCard: 'bg-white border-2',
          button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
      case 'sunset-gradient':
        return {
          container: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
          card: 'bg-white/80 backdrop-blur-sm border border-white shadow-xl',
          heading: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600',
          text: 'text-gray-700',
          statCard: 'bg-gradient-to-br shadow-lg',
          button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white',
        };
    }
  };

  const styles = getColorStyles();

  const getStatCardStyle = (color: string) => {
    if (colorScheme === 'ocean-blue') {
      return `${styles.statCard} from-${color}-500 to-${color}-600 text-white`;
    }
    if (colorScheme === 'royal-purple') {
      return `${styles.statCard} border-${color}-200 hover:border-${color}-400 transition-colors`;
    }
    return `${styles.statCard} from-${color}-100 to-${color}-200`;
  };

  return (
    <div className={`min-h-full ${styles.container}`}>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${styles.heading}`}>Dashboard</h1>
          <p className={styles.text}>Welcome back! Here's your social media performance overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to="/stats"
              className={`${styles.card} p-6 rounded-xl cursor-pointer group`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${
                  colorScheme === 'ocean-blue' ? `bg-${stat.color}-100` :
                  colorScheme === 'royal-purple' ? `bg-${stat.color}-50` :
                  `bg-gradient-to-br from-${stat.color}-100 to-${stat.color}-200`
                }`}>
                  <stat.icon className={`w-6 h-6 ${
                    colorScheme === 'ocean-blue' ? `text-${stat.color}-600` :
                    colorScheme === 'royal-purple' ? `text-${stat.color}-600` :
                    `text-${stat.color}-700`
                  }`} />
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-semibold">{stat.change}</span>
                </div>
              </div>
              <div>
                <p className={`text-sm mb-1 ${styles.text}`}>{stat.label}</p>
                <p className={`text-3xl font-bold ${styles.heading}`}>{stat.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <div className={`${styles.card} p-6 rounded-xl mb-8`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold ${styles.heading}`}>Recent Posts</h2>
            <Link to="/post" className={`px-4 py-2 rounded-lg font-medium transition-colors ${styles.button}`}>
              Create New Post
            </Link>
          </div>
          <div className="space-y-4">
            {recentPosts.map((post, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  colorScheme === 'ocean-blue' ? 'border-gray-200 hover:border-blue-300 bg-gray-50' :
                  colorScheme === 'royal-purple' ? 'border-gray-200 hover:bg-gray-50' :
                  'border-purple-200 hover:border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50'
                } transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        colorScheme === 'ocean-blue' ? 'bg-blue-100 text-blue-700' :
                        colorScheme === 'royal-purple' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700'
                      }`}>
                        {post.platform}
                      </span>
                      <span className={`text-sm ${styles.text}`}>{post.time}</span>
                    </div>
                    <p className={styles.text}>{post.content}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-2xl font-bold ${styles.heading}`}>{post.engagement}</p>
                    <p className={`text-xs ${styles.text}`}>engagements</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/draft" className={`${styles.card} p-6 rounded-xl hover:scale-105 transition-transform`}>
            <h3 className={`text-lg font-bold mb-2 ${styles.heading}`}>Manage Drafts</h3>
            <p className={styles.text}>View and edit your saved draft posts</p>
          </Link>
          <Link to="/monitor" className={`${styles.card} p-6 rounded-xl hover:scale-105 transition-transform`}>
            <h3 className={`text-lg font-bold mb-2 ${styles.heading}`}>Monitor Activity</h3>
            <p className={styles.text}>Track real-time social media activity</p>
          </Link>
          <Link to="/stats" className={`${styles.card} p-6 rounded-xl hover:scale-105 transition-transform`}>
            <h3 className={`text-lg font-bold mb-2 ${styles.heading}`}>View Analytics</h3>
            <p className={styles.text}>Deep dive into your performance metrics</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
