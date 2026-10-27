'use client'

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

// Curated palette — no random gradients, just clean solid colors
const AVATAR_PALETTE = [
  { bg: '#111111', text: '#FFFFFF' },  // Black
  { bg: '#1a1a2e', text: '#e0e0ff' },  // Deep navy
  { bg: '#16213e', text: '#a8d8ea' },  // Dark blue
  { bg: '#0f3460', text: '#e0f0ff' },  // Ocean
  { bg: '#1b4332', text: '#b7e4c7' },  // Forest
  { bg: '#2d6a4f', text: '#d8f3dc' },  // Emerald
  { bg: '#3a0ca3', text: '#d4c5f9' },  // Royal purple
  { bg: '#7209b7', text: '#f0d9ff' },  // Violet
  { bg: '#c2185b', text: '#fce4ec' },  // Rose
  { bg: '#b91c1c', text: '#fecaca' },  // Crimson
  { bg: '#c2410c', text: '#fed7aa' },  // Burnt orange
  { bg: '#854d0e', text: '#fef3c7' },  // Amber
  { bg: '#065f46', text: '#a7f3d0' },  // Teal
  { bg: '#0e7490', text: '#cffafe' },  // Cyan
  { bg: '#4338ca', text: '#e0e7ff' },  // Indigo
  { bg: '#6d28d9', text: '#ede9fe' },  // Purple
]

function getAvatarStyle(username: string) {
  const hash = hashCode(username)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// Geometric shape based on username hash — makes each avatar unique
function getPattern(username: string): 'circle' | 'diamond' | 'ring' | 'dot' | 'none' {
  const hash = hashCode(username)
  const patterns = ['circle', 'diamond', 'ring', 'dot', 'none'] as const
  return patterns[(hash >> 4) % patterns.length]
}

const SIZES = {
  sm: { container: 'w-6 h-6', text: 'text-[9px]', ring: 8, dot: 3 },
  md: { container: 'w-8 h-8', text: 'text-[11px]', ring: 10, dot: 3.5 },
  lg: { container: 'w-10 h-10', text: 'text-sm', ring: 14, dot: 4 },
  xl: { container: 'w-14 h-14', text: 'text-xl', ring: 18, dot: 5 },
} as const

interface GradientAvatarProps {
  username: string
  size?: keyof typeof SIZES
  className?: string
}

export function GradientAvatar({ username, size = 'md', className = '' }: GradientAvatarProps) {
  const style = getAvatarStyle(username || 'unknown')
  const pattern = getPattern(username || 'unknown')
  const { container, text, ring, dot } = SIZES[size]
  const letter = (username || '?').charAt(0).toUpperCase()

  return (
    <div
      className={`${container} rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden ${className}`}
      style={{ backgroundColor: style.bg }}
    >
      {/* Subtle geometric accent */}
      {pattern === 'circle' && (
        <div
          className="absolute opacity-[0.08] rounded-full"
          style={{
            width: ring * 2,
            height: ring * 2,
            border: `1.5px solid ${style.text}`,
            top: -ring * 0.4,
            right: -ring * 0.4,
          }}
        />
      )}
      {pattern === 'diamond' && (
        <div
          className="absolute opacity-[0.08]"
          style={{
            width: ring,
            height: ring,
            border: `1.5px solid ${style.text}`,
            transform: 'rotate(45deg)',
            bottom: -ring * 0.3,
            left: -ring * 0.3,
          }}
        />
      )}
      {pattern === 'ring' && (
        <div
          className="absolute opacity-[0.06] rounded-full"
          style={{
            width: ring * 2.5,
            height: ring * 2.5,
            border: `1px solid ${style.text}`,
            bottom: -ring,
            right: -ring,
          }}
        />
      )}
      {pattern === 'dot' && (
        <div
          className="absolute rounded-full opacity-[0.12]"
          style={{
            width: dot,
            height: dot,
            backgroundColor: style.text,
            top: dot,
            right: dot,
          }}
        />
      )}

      {/* Letter */}
      <span
        className={`${text} font-bold relative z-10`}
        style={{ color: style.text }}
      >
        {letter}
      </span>
    </div>
  )
}
