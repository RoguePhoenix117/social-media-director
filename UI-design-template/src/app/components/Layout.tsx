import { Outlet, NavLink } from 'react-router';
import {
  LayoutDashboard,
  FileEdit,
  Send,
  Activity,
  BarChart3,
  Settings,
  User
} from 'lucide-react';
import { useDesign } from '../contexts/DesignContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/draft', label: 'Draft', icon: FileEdit },
  { path: '/post', label: 'Post', icon: Send },
  { path: '/monitor', label: 'Monitor', icon: Activity },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
];

export function Layout() {
  const { colorScheme, layoutVariant } = useDesign();

  const getColorStyles = () => {
    switch (colorScheme) {
      case 'ocean-blue':
        return {
          sidebar: 'bg-gradient-to-b from-slate-900 to-slate-800 text-white',
          topNav: 'bg-gradient-to-r from-slate-900 to-slate-800 text-white border-b border-slate-700',
          navItem: 'hover:bg-white/10 text-white/70 hover:text-white',
          navItemActive: 'bg-blue-600 text-white',
          main: 'bg-slate-50',
        };
      case 'royal-purple':
        return {
          sidebar: 'bg-white border-r border-gray-200 text-gray-700',
          topNav: 'bg-white border-b border-gray-200 text-gray-700',
          navItem: 'hover:bg-gray-100 text-gray-600 hover:text-gray-900',
          navItemActive: 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600',
          main: 'bg-gray-50',
        };
      case 'sunset-gradient':
        return {
          sidebar: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white',
          topNav: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-b border-white/20',
          navItem: 'hover:bg-white/20 text-white/80 hover:text-white backdrop-blur-sm',
          navItemActive: 'bg-white/30 text-white shadow-lg',
          main: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
        };
    }
  };

  const styles = getColorStyles();

  // Sidebar Left Layout (Original)
  if (layoutVariant === 'sidebar-left') {
    return (
      <div className="flex h-screen overflow-hidden">
        <aside className={`w-64 flex flex-col ${styles.sidebar}`}>
          <div className="p-6">
            <h1 className="text-2xl font-bold">SocialHub</h1>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive ? styles.navItemActive : styles.navItem
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-3 space-y-2 border-t border-white/10">
            <NavLink to="/settings" className={({ isActive }) =>
              `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive ? styles.navItemActive : styles.navItem
              }`
            }>
              <Settings className="w-5 h-5" />
              <span className="font-medium">Settings</span>
            </NavLink>
            <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${styles.navItem}`}>
              <User className="w-5 h-5" />
              <span className="font-medium">Profile</span>
            </button>
          </div>
        </aside>
        <main className={`flex-1 overflow-auto ${styles.main}`}>
          <Outlet />
        </main>
      </div>
    );
  }

  // Top Navigation Layout
  if (layoutVariant === 'top-nav') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className={`${styles.topNav}`}>
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-bold">SocialHub</h1>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive ? styles.navItemActive : styles.navItem
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <NavLink to="/settings" className={({ isActive }) =>
                `p-2 rounded-lg transition-all ${
                  isActive ? styles.navItemActive : styles.navItem
                }`
              }>
                <Settings className="w-5 h-5" />
              </NavLink>
              <button className={`p-2 rounded-lg transition-all ${styles.navItem}`}>
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
        <main className={`flex-1 overflow-auto ${styles.main}`}>
          <Outlet />
        </main>
      </div>
    );
  }

  // Sidebar Right Layout
  if (layoutVariant === 'sidebar-right') {
    return (
      <div className="flex h-screen overflow-hidden">
        <main className={`flex-1 overflow-auto ${styles.main}`}>
          <Outlet />
        </main>
        <aside className={`w-64 flex flex-col ${styles.sidebar}`}>
          <div className="p-6">
            <h1 className="text-2xl font-bold text-right">SocialHub</h1>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all flex-row-reverse ${
                    isActive ? styles.navItemActive : styles.navItem
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-3 space-y-2 border-t border-white/10">
            <NavLink to="/settings" className={({ isActive }) =>
              `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all flex-row-reverse ${
                isActive ? styles.navItemActive : styles.navItem
              }`
            }>
              <Settings className="w-5 h-5" />
              <span className="font-medium">Settings</span>
            </NavLink>
            <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all flex-row-reverse ${styles.navItem}`}>
              <User className="w-5 h-5" />
              <span className="font-medium">Profile</span>
            </button>
          </div>
        </aside>
      </div>
    );
  }

  return null;
}
