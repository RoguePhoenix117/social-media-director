import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
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
import { PlatformIcon } from './platform-icons'

const dashboardStats = [
  { label: 'Total Followers', value: '24.5K', change: '+12%', icon: Users, tone: 'blue' },
  { label: 'Engagement Rate', value: '8.2%', change: '+3.1%', icon: Heart, tone: 'pink' },
  { label: 'Total Impressions', value: '156K', change: '+18%', icon: Eye, tone: 'purple' },
  { label: 'Comments', value: '1,247', change: '+22%', icon: MessageCircle, tone: 'green' },
] as const

const recentPosts = [
  { platform: 'x', label: 'X', content: 'Just launched our new product narrative...', engagement: '2.4K', time: '2h ago' },
  { platform: 'linkedin', label: 'LinkedIn', content: 'A practical field note for operators...', engagement: '856', time: '5h ago' },
  { platform: 'instagram', label: 'Instagram', content: 'Behind the scenes from the campaign room...', engagement: '3.1K', time: '1d ago' },
]

type PostPageSettings = {
  xConfigured: boolean
  linkedinConfigured: boolean
}

type GeneratedPostDrafts = {
  masterPost: string
  sourceTitle: string
  variants: Array<{
    provider: 'x' | 'linkedin'
    text: string
  }>
}

const platforms = [
  { id: 'x', name: 'Twitter/X', maxChars: 280, setupHash: 'x-publishing' },
  { id: 'linkedin', name: 'LinkedIn', maxChars: 3000, setupHash: 'linkedin-publishing' },
  { id: 'instagram', name: 'Instagram', maxChars: 2200 },
  { id: 'facebook', name: 'Facebook', maxChars: 63206 },
  { id: 'threads', name: 'Threads', maxChars: 500 },
  { id: 'tiktok', name: 'TikTok', maxChars: 2200 },
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
                  <span>
                    <PlatformIcon platform={post.platform} size={14} />
                    {post.label}
                  </span>
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

export function TemplatePostPage({
  settings,
  onGenerate,
}: Readonly<{
  settings: PostPageSettings
  onGenerate: (prompt: string) => Promise<GeneratedPostDrafts>
}>) {
  const [masterPost, setMasterPost] = useState('')
  const [platformPosts, setPlatformPosts] = useState(
    Object.fromEntries(platforms.map((platform) => [platform.id, ''])),
  )
  const [linkedPlatforms, setLinkedPlatforms] = useState(new Set(platforms.map((platform) => platform.id)))
  const [aiPrompt, setAiPrompt] = useState('')
  const [generationStatus, setGenerationStatus] = useState<string>()
  const [generationError, setGenerationError] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)

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

  async function handleGenerate() {
    const prompt = aiPrompt.trim()
    setGenerationError(undefined)

    if (!prompt) {
      setGenerationStatus(undefined)
      setGenerationError('Enter a prompt or URL before generating.')
      return
    }

    setIsGenerating(true)
    setGenerationStatus('Generating platform drafts from your prompt...')

    try {
      const result = await onGenerate(prompt)
      const generatedPosts = Object.fromEntries(
        result.variants.map((variant) => [variant.provider, variant.text]),
      )
      setMasterPost(result.masterPost)
      setPlatformPosts((current) => ({
        ...current,
        ...generatedPosts,
      }))
      setLinkedPlatforms((current) => {
        const next = new Set(current)
        for (const variant of result.variants) {
          next.delete(variant.provider)
        }
        return next
      })
      setGenerationStatus(`Generated ${result.variants.length} drafts from ${result.sourceTitle}.`)
    } catch (caught) {
      setGenerationStatus(undefined)
      setGenerationError(caught instanceof Error ? caught.message : 'Generation failed.')
    } finally {
      setIsGenerating(false)
    }
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
            aria-describedby={generationStatus || generationError ? 'post-generation-status' : undefined}
            onChange={(event) => {
              setGenerationError(undefined)
              setAiPrompt(event.target.value)
            }}
            placeholder="Enter a prompt or paste a blog post URL..."
            type="text"
            value={aiPrompt}
          />
          <button disabled={isGenerating} onClick={() => void handleGenerate()} type="button">
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {generationStatus ? (
          <p className="generation-status" id="post-generation-status" role="status">
            {generationStatus}
          </p>
        ) : null}
        {generationError ? (
          <p className="error" id="post-generation-status" role="alert">
            {generationError}
          </p>
        ) : null}
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
            const isConnected =
              platform.id === 'x'
                ? settings.xConfigured
                : platform.id === 'linkedin'
                  ? settings.linkedinConfigured
                  : false
            return (
              <article className={isLinked ? 'template-card platform-card linked' : 'template-card platform-card'} key={platform.id}>
                <div className="platform-card-header">
                  <div className="platform-mark">
                    <PlatformIcon platform={platform.id} size={20} />
                  </div>
                  <div>
                    <h3>{platform.name}</h3>
                    <p>{isConnected ? 'Connected' : platform.setupHash ? 'Needs setup' : 'Unavailable'}</p>
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
                {isConnected ? (
                  <button disabled={overLimit || !text.trim()} type="button">
                    Post Now
                  </button>
                ) : platform.setupHash ? (
                  <Link className="setup-post-button" hash={platform.setupHash} to="/settings">
                    <Send aria-hidden="true" size={17} />
                    Setup to Post
                  </Link>
                ) : (
                  <button disabled type="button">
                    Unavailable
                  </button>
                )}
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
