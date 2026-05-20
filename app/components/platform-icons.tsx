import {
  siFacebook,
  siInstagram,
  siThreads,
  siTiktok,
  siX,
  siYoutube,
  type SimpleIcon,
} from 'simple-icons'

const platformIcons: Record<string, SimpleIcon> = {
  facebook: siFacebook,
  instagram: siInstagram,
  threads: siThreads,
  tiktok: siTiktok,
  x: siX,
  youtube: siYoutube,
}

const linkedInFallback = {
  color: '#0a66c2',
  label: 'LinkedIn',
  text: 'in',
}

export function PlatformIcon({
  platform,
  size = 18,
}: Readonly<{
  platform: string
  size?: number
}>) {
  const normalized = platform.toLowerCase()
  const icon = platformIcons[normalized]

  if (!icon && normalized === 'linkedin') {
    return (
      <span
        aria-hidden="true"
        className="platform-icon-text"
        style={{
          color: linkedInFallback.color,
          fontSize: Math.max(11, Math.round(size * 0.72)),
          height: size,
          width: size,
        }}
      >
        {linkedInFallback.text}
      </span>
    )
  }

  if (!icon) return null

  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      role="img"
      style={{ color: `#${icon.hex}` }}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={icon.path} />
    </svg>
  )
}
