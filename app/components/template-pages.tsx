import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  Construction,
  Eye,
  FileText,
  Heart,
  Link2,
  MessageCircle,
  Palette,
  Send,
  Sparkles,
  TrendingUp,
  Unlink,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { AppLayout } from './app-layout'
import { useDesign, type ColorScheme, type LayoutVariant } from './design-context'

const dashboardStats = [
  { label: 'Total Followers', value: '24.5K', change: '+12%', icon: Users, tone: 'blue' },
  { label: 'Engagement Rate', value: '8.2%', change: '+3.1%', icon: Heart, tone: 'pink' },
  { label: 'Total Impressions', value: '156K', change: '+18%', icon: Eye, tone: 'purple' },
  { label: 'Comments', value: '1,247', change: '+22%', icon: MessageCircle, tone: 'green' },
] as const

const recentPosts = [
  { platform: 'X', content: 'Just launched our new product narrative...', engagement: '2.4K', time: '2h ago' },
  { platform: 'LinkedIn', content: 'A practical field note for operators...', engagement: '856', time: '5h ago' },
  { platform: 'Instagram', content: 'Behind the scenes from the campaign room...', engagement: '3.1K', time: '1d ago' },
]

const platforms = [
  { id: 'x', name: 'Twitter/X', icon: 'X', maxChars: 280, connected: true },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', maxChars: 3000, connected: true },
  { id: 'instagram', name: 'Instagram', icon: 'IG', maxChars: 2200, connected: false },
  { id: 'facebook', name: 'Facebook', icon: 'f', maxChars: 63206, connected: true },
  { id: 'threads', name: 'Threads', icon: '@', maxChars: 500, connected: false },
  { id: 'tiktok', name: 'TikTok', icon: '♪', maxChars: 2200, connected: false },
]

const colorSchemes = [
  {
    id: 'ocean-blue' as const,
    name: 'Ocean Blue',
    description: 'Clean slate gray with calm blue accents',
    preview: 'preview-ocean',
  },
  {
    id: 'royal-purple' as const,
    name: 'Royal Purple',
    description: 'White surfaces with sophisticated indigo tones',
    preview: 'preview-purple',
  },
  {
    id: 'sunset-gradient' as const,
    name: 'Sunset Gradient',
    description: 'Vibrant purple-to-pink energy for presentation mode',
    preview: 'preview-sunset',
  },
]

const layoutVariants = [
  { id: 'sidebar-left' as const, name: 'Left Sidebar', description: 'Classic navigation on the left side' },
  { id: 'top-nav' as const, name: 'Top Navigation', description: 'Horizontal navigation bar at the top' },
  { id: 'sidebar-right' as const, name: 'Right Sidebar', description: 'Navigation positioned on the right' },
]

export function TemplateDashboardPage() {
  return (
    <AppLayout>
      <TemplatePageHeader
        eyebrow="Dashboard"
        title="Social Media Director"
        summary="Welcome back. Here is the social media performance overview from the design template, adapted into TanStack Start."
      />

      <section className="stats-grid template-stats" aria-label="Performance overview">
        {dashboardStats.map((stat) => (
          <Link className="stat-card stat-link" key={stat.label} to="/stats">
            <div className={`stat-icon tone-${stat.tone}`}>
              <stat.icon aria-hidden="true" size={22} />
            </div>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </div>
            <span className="trend-badge">
              <TrendingUp aria-hidden="true" size={15} />
              {stat.change}
            </span>
          </Link>
        ))}
      </section>

      <section className="template-card">
        <div className="section-heading">
          <h2>Recent Posts</h2>
          <Link className="button-link" to="/post">
            <Send aria-hidden="true" size={17} />
            Create New Post
          </Link>
        </div>
        <div className="activity-list">
          {recentPosts.map((post) => (
            <article className="activity-item" key={`${post.platform}-${post.time}`}>
              <div>
                <div className="activity-meta">
                  <span>{post.platform}</span>
                  <small>{post.time}</small>
                </div>
                <p>{post.content}</p>
              </div>
              <div className="activity-score">
                <strong>{post.engagement}</strong>
                <small>engagements</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="quick-actions">
        <Link className="template-card action-card" to="/draft">
          <h3>Manage Drafts</h3>
          <p>View and edit saved draft posts.</p>
        </Link>
        <Link className="template-card action-card" to="/monitor">
          <h3>Monitor Activity</h3>
          <p>Track real-time social media activity.</p>
        </Link>
        <Link className="template-card action-card" to="/stats">
          <h3>View Analytics</h3>
          <p>Deep dive into performance metrics.</p>
        </Link>
      </section>
    </AppLayout>
  )
}

export function TemplatePostPage() {
  const [masterPost, setMasterPost] = useState('')
  const [platformPosts, setPlatformPosts] = useState(
    Object.fromEntries(platforms.map((platform) => [platform.id, ''])),
  )
  const [linkedPlatforms, setLinkedPlatforms] = useState(new Set(platforms.map((platform) => platform.id)))
  const [aiPrompt, setAiPrompt] = useState('')

  function handleMasterChange(value: string) {
    setMasterPost(value)
    setPlatformPosts((current) => ({
      ...current,
      ...Object.fromEntries([...linkedPlatforms].map((id) => [id, value])),
    }))
  }

  function handlePlatformChange(platformId: string, value: string) {
    setPlatformPosts((current) => ({ ...current, [platformId]: value }))
    setLinkedPlatforms((current) => {
      const next = new Set(current)
      next.delete(platformId)
      return next
    })
  }

  function toggleLink(platformId: string) {
    setLinkedPlatforms((current) => {
      const next = new Set(current)
      if (next.has(platformId)) {
        next.delete(platformId)
      } else {
        next.add(platformId)
        setPlatformPosts((posts) => ({ ...posts, [platformId]: masterPost }))
      }
      return next
    })
  }

  return (
    <AppLayout>
      <TemplatePageHeader
        eyebrow="Create Post"
        title="Compose once, adapt everywhere"
        summary="The template post composer behavior is restored: master copy syncs to linked platform boxes, while unlinked boxes can be customized."
      />

      <section className="template-card assistant-card">
        <div className="panel-heading">
          <Sparkles aria-hidden="true" size={22} />
          <div>
            <h2>AI Content Assistant</h2>
            <p>Enter a prompt or paste a source URL.</p>
          </div>
        </div>
        <div className="assistant-row">
          <input
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Enter a prompt or paste a blog post URL..."
            type="text"
            value={aiPrompt}
          />
          <button type="button">Generate</button>
        </div>
      </section>

      <section className="template-card">
        <div className="panel-heading">
          <FileText aria-hidden="true" size={22} />
          <div>
            <h2>Master Post</h2>
            <p>Synced to {linkedPlatforms.size} platform{linkedPlatforms.size === 1 ? '' : 's'}.</p>
          </div>
        </div>
        <textarea
          onChange={(event) => handleMasterChange(event.target.value)}
          placeholder="Write your post here. Linked platform boxes below will update automatically."
          rows={6}
          value={masterPost}
        />
        <div className="variant-meta">
          <span>{masterPost.length} characters</span>
        </div>
      </section>

      <section>
        <h2 className="section-title">Platform Posts</h2>
        <div className="platform-grid">
          {platforms.map((platform) => {
            const isLinked = linkedPlatforms.has(platform.id)
            const text = platformPosts[platform.id] ?? ''
            const overLimit = text.length > platform.maxChars
            return (
              <article className={isLinked ? 'template-card platform-card linked' : 'template-card platform-card'} key={platform.id}>
                <div className="platform-card-header">
                  <div className="platform-mark">{platform.icon}</div>
                  <div>
                    <h3>{platform.name}</h3>
                    <p>{platform.connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                  <button
                    aria-label={isLinked ? `Unlink ${platform.name}` : `Link ${platform.name}`}
                    className="icon-button"
                    onClick={() => toggleLink(platform.id)}
                    type="button"
                  >
                    {isLinked ? <Link2 aria-hidden="true" size={18} /> : <Unlink aria-hidden="true" size={18} />}
                  </button>
                </div>
                <textarea
                  disabled={isLinked}
                  onChange={(event) => handlePlatformChange(platform.id, event.target.value)}
                  placeholder={isLinked ? 'Linked to master post...' : 'Customize for this platform...'}
                  rows={4}
                  value={text}
                />
                <div className={overLimit ? 'char-row over-limit' : 'char-row'}>
                  <span>
                    {overLimit ? <AlertCircle aria-hidden="true" size={15} /> : <Check aria-hidden="true" size={15} />}
                    {overLimit ? 'Over limit' : 'Good'}
                  </span>
                  <span>
                    {text.length} / {platform.maxChars}
                  </span>
                </div>
                <button disabled={!platform.connected} type="button">
                  {platform.connected ? 'Post Now' : 'Copy to Clipboard'}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </AppLayout>
  )
}

export function TemplateSettingsPage() {
  const { colorScheme, layoutVariant, setColorScheme, setLayoutVariant } = useDesign()

  return (
    <AppLayout>
      <TemplatePageHeader
        eyebrow="Settings"
        title="Customize your workspace"
        summary="Switch between the UI template's layout variants and color systems. The selection applies to all restored routes."
      />

      <section className="template-card">
        <div className="panel-heading">
          <Activity aria-hidden="true" size={22} />
          <div>
            <h2>Layout Style</h2>
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
      </section>

      <section className="template-card">
        <div className="panel-heading">
          <Palette aria-hidden="true" size={22} />
          <div>
            <h2>Color Scheme</h2>
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
      </section>
    </AppLayout>
  )
}

export function TemplatePlaceholderPage({
  routeName,
}: Readonly<{
  routeName: 'Draft' | 'Monitor' | 'Stats'
}>) {
  return (
    <AppLayout>
      <section className="placeholder-page">
        <div className="template-card placeholder-card">
          <Construction aria-hidden="true" size={58} />
          <h1>{routeName}</h1>
          <p>
            This route is restored from the template navigation. The production workflow can
            grow here without changing the shared layout or design settings.
          </p>
          <Link className="button-link" to="/">
            Back to Dashboard
          </Link>
        </div>
      </section>
    </AppLayout>
  )
}

function TemplatePageHeader({
  eyebrow,
  title,
  summary,
}: Readonly<{ eyebrow: string; title: string; summary: string }>) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-summary">{summary}</p>
      </div>
    </header>
  )
}
