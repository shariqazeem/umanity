'use client'

/**
 * The Proof Orb from the original Umanity: a living badge that grows and glows
 * with what someone has given and how much the network engaged with it.
 * Emerald → silver → gold → diamond as lifetime giving crosses each tier.
 */
export function orbColors(totalDonated: number) {
  if (totalDonated >= 1.0) return { primary: '#3b82f6', secondary: '#8b5cf6', glyph: '💎', tier: 'Diamond' }
  if (totalDonated >= 0.5) return { primary: '#eab308', secondary: '#f59e0b', glyph: '🥇', tier: 'Gold' }
  if (totalDonated >= 0.1) return { primary: '#9ca3af', secondary: '#d1d5db', glyph: '🥈', tier: 'Silver' }
  return { primary: '#10b981', secondary: '#34d399', glyph: '✦', tier: 'Bronze' }
}

export function ProofOrb({ totalDonated, engagement = 0, size = 'md', className = '' }: { totalDonated: number; engagement?: number; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const donationLevel = Math.min(totalDonated * 10, 10)
  const socialLevel = Math.min(engagement * 0.5, 10)
  const intensity = Math.min((donationLevel + socialLevel) / 2, 10)
  const baseSize = size === 'sm' ? 40 : size === 'md' ? 64 : size === 'lg' ? 96 : 140
  const orbSize = baseSize + intensity * (baseSize * 0.15)
  const glowRadius = 10 + intensity * 4
  const opacity = 0.3 + intensity * 0.07
  const c = orbColors(totalDonated)
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: orbSize, height: orbSize }} title={`${c.tier} orb · ${totalDonated.toFixed(2)} SOL given`}>
      <div
        className="absolute inset-0 rounded-full orb-glow"
        style={{
          background: `radial-gradient(circle, ${c.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 0%, ${c.secondary}15 50%, transparent 70%)`,
          boxShadow: `0 0 ${glowRadius}px ${c.primary}40, 0 0 ${glowRadius * 2}px ${c.primary}20`,
        }}
      />
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: baseSize * 0.6,
          height: baseSize * 0.6,
          background: `radial-gradient(circle at 35% 35%, ${c.secondary}, ${c.primary})`,
          boxShadow: `inset 0 -2px 6px rgba(0,0,0,0.15), 0 2px 8px ${c.primary}50`,
        }}
      >
        <span className="font-bold text-white" style={{ fontSize: baseSize * 0.16 }}>
          {c.glyph}
        </span>
      </div>
      {engagement > 0 && <div className="absolute rounded-full border-2 animate-pulse" style={{ width: orbSize * 0.85, height: orbSize * 0.85, borderColor: `${c.primary}30` }} />}
    </div>
  )
}
