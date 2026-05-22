import { Link } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  FileEdit,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useDesign } from './design-context'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/draft', label: 'Draft', icon: FileEdit },
  { to: '/post', label: 'Post', icon: Send },
  { to: '/monitor', label: 'Monitor', icon: Activity },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
] as const

export function AppLayout({
  children,
  operatorName,
  onLogout,
  projectSwitcher,
}: Readonly<{
  children: ReactNode
  operatorName?: string
  onLogout?: () => void
  /**
   * Optional slot for {@link ProjectSwitcher}. Rendered in the sidebar under
   * the operator card (left/right sidebar variants) or in the top-nav
   * actions row (top-nav variant). Routes that don't have a session-bound
   * operator (e.g. template pages, setup) omit this prop.
   */
  projectSwitcher?: ReactNode
}>) {
  const { colorScheme, layoutVariant } = useDesign()
  const shellClass = `director-shell ${colorScheme} ${layoutVariant}`
  const sidebar = (
    <Sidebar onLogout={onLogout} operatorName={operatorName} projectSwitcher={projectSwitcher} />
  )
  const main = <main className="app-shell">{children}</main>

  if (layoutVariant === 'top-nav') {
    return (
      <div className={shellClass}>
        <TopNav onLogout={onLogout} operatorName={operatorName} projectSwitcher={projectSwitcher} />
        {main}
      </div>
    )
  }

  return (
    <div className={shellClass}>
      {layoutVariant === 'sidebar-left' ? sidebar : main}
      {layoutVariant === 'sidebar-left' ? main : sidebar}
    </div>
  )
}

function Brand({ align = 'left' }: Readonly<{ align?: 'left' | 'right' }>) {
  return (
    <div className={`brand-block ${align === 'right' ? 'brand-block-right' : ''}`}>
      <div className="brand-mark">
        <Sparkles aria-hidden="true" size={22} />
      </div>
      <div>
        <p className="brand-kicker">SocialHub</p>
        <h1>Director</h1>
      </div>
    </div>
  )
}

function Sidebar({
  operatorName,
  onLogout,
  projectSwitcher,
}: Readonly<{
  operatorName?: string
  onLogout?: () => void
  projectSwitcher?: ReactNode
}>) {
  const { layoutVariant } = useDesign()
  const right = layoutVariant === 'sidebar-right'

  return (
    <aside className="sidebar">
      <Brand align={right ? 'right' : 'left'} />
      <nav className="sidebar-nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            activeProps={{ className: 'active' }}
            className={right ? 'reverse' : undefined}
            key={item.to}
            to={item.to}
          >
            <item.icon aria-hidden="true" size={19} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="operator-card">
        <p className="eyebrow">Operator</p>
        <strong>{operatorName ?? 'Local operator'}</strong>
        {projectSwitcher ? (
          <div className="operator-card-switcher">{projectSwitcher}</div>
        ) : null}
        <Link activeProps={{ className: 'active' }} to="/settings">
          <Settings aria-hidden="true" size={17} />
          Settings
        </Link>
        <button className="ghost-button" onClick={onLogout} type="button">
          {onLogout ? <LogOut aria-hidden="true" size={17} /> : <User aria-hidden="true" size={17} />}
          {onLogout ? 'Log out' : 'Profile'}
        </button>
      </div>
    </aside>
  )
}

function TopNav({
  operatorName,
  onLogout,
  projectSwitcher,
}: Readonly<{
  operatorName?: string
  onLogout?: () => void
  projectSwitcher?: ReactNode
}>) {
  return (
    <header className="top-nav">
      <Brand />
      <nav className="top-nav-links" aria-label="Primary">
        {navItems.map((item) => (
          <Link activeProps={{ className: 'active' }} key={item.to} to={item.to}>
            <item.icon aria-hidden="true" size={18} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="top-nav-actions">
        {projectSwitcher}
        <Link activeProps={{ className: 'active' }} aria-label="Settings" to="/settings">
          <Settings aria-hidden="true" size={18} />
        </Link>
        <button className="ghost-button" onClick={onLogout} title={operatorName} type="button">
          {onLogout ? <LogOut aria-hidden="true" size={17} /> : <User aria-hidden="true" size={17} />}
        </button>
      </div>
    </header>
  )
}
