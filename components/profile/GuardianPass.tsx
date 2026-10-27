'use client'

/**
 * The Living Guardian pass: one quiet card whose tone deepens with the tier.
 * Seed and Sprout are white, Bloom and Guardian carry a soft green wash,
 * Sovereign is ink. Same shape at every level, so progress reads instantly.
 */
import { Icon } from '@/components/shared/ui'
import { TIERS, type GuardianState, type GuardianTier } from '@/lib/guardian'
import { short } from '@/lib/client/api'

const TONE: Record<GuardianTier, { bg: string; border: string; ink: string; soft: string; emblem: string }> = {
  Seed: { bg: '#ffffff', border: 'rgba(0,0,0,0.06)', ink: '#1d1d1f', soft: '#6e6e73', emblem: '#f5f5f7' },
  Sprout: { bg: '#fbfdfc', border: 'rgba(16,185,129,0.14)', ink: '#1d1d1f', soft: '#6e6e73', emblem: '#ecfdf5' },
  Bloom: { bg: '#f3fbf7', border: 'rgba(16,185,129,0.18)', ink: '#1d1d1f', soft: '#5f6b66', emblem: '#d1fae5' },
  Guardian: { bg: '#e9f7f0', border: 'rgba(16,185,129,0.24)', ink: '#14352a', soft: '#4f6a5f', emblem: '#bdeed6' },
  Sovereign: { bg: '#1d1d1f', border: 'rgba(255,255,255,0.08)', ink: '#ffffff', soft: 'rgba(255,255,255,0.62)', emblem: 'rgba(52,211,153,0.16)' },
}

const EMBLEM: Record<GuardianTier, string> = { Seed: 'spark', Sprout: 'heart', Bloom: 'flame', Guardian: 'shield', Sovereign: 'trophy' }

export function GuardianPass({ guardian, name, handle, address, foundingRank, compact }: { guardian: GuardianState; name: string; handle: string; address: string; foundingRank?: number | null; compact?: boolean }) {
  const t = TONE[guardian.tier]
  const dark = guardian.tier === 'Sovereign'
  const idx = TIERS.findIndex((x) => x.tier === guardian.tier)
  return (
    <section className="rounded-[28px] p-6 sm:p-7 relative overflow-hidden" style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.ink, boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.25)' : 'var(--shadow-sm)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow" style={{ color: t.soft }}>
            Living Guardian · Tier {guardian.level} of {TIERS.length}
          </p>
          <h2 className="font-display leading-none mt-2" style={{ fontSize: compact ? 36 : 44 }}>
            {guardian.tier}
          </h2>
          <p className="text-[13px] mt-2 truncate" style={{ color: t.soft }}>
            {name} · @{handle} · <span className="num">{short(address)}</span>
          </p>
        </div>
        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.emblem, color: dark ? '#34d399' : '#047857' }}>
          <Icon name={EMBLEM[guardian.tier]} size={24} />
        </div>
      </div>

      <div className="mt-6">
        <div className="progress" style={{ background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }}>
          <span style={{ width: `${Math.round(guardian.progress * 100)}%`, background: dark ? '#34d399' : '#10b981' }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[12.5px]" style={{ color: t.soft }}>
          <span>
            <span className="num font-semibold" style={{ color: t.ink }}>
              {guardian.score.toLocaleString()}
            </span>{' '}
            score
          </span>
          <span className="num">{guardian.nextTier ? `${guardian.pointsToNext.toLocaleString()} to ${guardian.nextTier}` : 'Highest tier'}</span>
        </div>
      </div>

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ color: t.soft }}>
          {guardian.perks.map((p, i) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="w-1 h-1 rounded-full" style={{ background: t.soft, opacity: 0.6 }} />}
              {p}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {TIERS.map((x, i) => (
            <span key={x.tier} title={x.tier} className="h-1.5 rounded-full transition-all" style={{ width: i <= idx ? 22 : 10, background: i <= idx ? (dark ? '#34d399' : '#10b981') : dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)' }} />
          ))}
        </div>
        {foundingRank != null && foundingRank <= 100 && (
          <span className="pill" style={{ background: dark ? 'rgba(52,211,153,0.16)' : '#ecfdf5', color: dark ? '#34d399' : '#047857' }}>
            Founding giver #{foundingRank}
          </span>
        )}
      </div>
    </section>
  )
}
