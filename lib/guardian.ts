/**
 * Living Impact Guardian — the evolving pass every account carries.
 * Tier is a pure function of impact points, streak and verified giving so it
 * can be rendered identically on the client, the server and in share cards.
 */
export type GuardianTier = 'Seed' | 'Sprout' | 'Bloom' | 'Guardian' | 'Sovereign'

export interface GuardianState {
  tier: GuardianTier
  level: 1 | 2 | 3 | 4 | 5
  score: number
  nextTier: GuardianTier | null
  progress: number // 0..1 toward next tier
  pointsToNext: number
  perks: string[]
  feeRebateBps: number
  dareBoostMultiplier: number
}

export const TIERS: { tier: GuardianTier; min: number; perks: string[]; rebate: number; boost: number }[] = [
  { tier: 'Seed', min: 0, perks: ['Impact certificates', 'Vote on releases'], rebate: 0, boost: 1 },
  { tier: 'Sprout', min: 250, perks: ['Create proposals', 'Dare friends', '5% dare fee rebate'], rebate: 500, boost: 1.1 },
  { tier: 'Bloom', min: 1000, perks: ['Featured on leaderboard', '15% dare fee rebate', '1.25x dare points'], rebate: 1500, boost: 1.25 },
  { tier: 'Guardian', min: 3000, perks: ['Field Fund council seat', '30% dare fee rebate', '1.5x dare points'], rebate: 3000, boost: 1.5 },
  { tier: 'Sovereign', min: 10000, perks: ['Milestone oracle reviewer', '50% dare fee rebate', '2x dare points'], rebate: 5000, boost: 2 },
]

export function guardianScore(input: { rewardPoints: number; streakCurrent: number; donationCount: number; votes?: number }): number {
  // Points are the base; streaks and consistency compound it.
  const streakBonus = Math.min(input.streakCurrent, 30) * 15
  const consistency = Math.min(input.donationCount, 50) * 5
  const votes = Math.min(input.votes ?? 0, 50) * 10
  return Math.round(input.rewardPoints + streakBonus + consistency + votes)
}

export function guardianFor(input: { rewardPoints: number; streakCurrent: number; donationCount: number; votes?: number }): GuardianState {
  const score = guardianScore(input)
  let idx = 0
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (score >= TIERS[i].min) {
      idx = i
      break
    }
  }
  const t = TIERS[idx]
  const next = TIERS[idx + 1] ?? null
  const progress = next ? Math.min(1, (score - t.min) / (next.min - t.min)) : 1
  return {
    tier: t.tier,
    level: (idx + 1) as GuardianState['level'],
    score,
    nextTier: next?.tier ?? null,
    progress,
    pointsToNext: next ? Math.max(0, next.min - score) : 0,
    perks: t.perks,
    feeRebateBps: t.rebate,
    dareBoostMultiplier: t.boost,
  }
}

export const TIER_COLORS: Record<GuardianTier, { from: string; to: string; accent: string; glyph: string }> = {
  Seed: { from: '#f4f4f2', to: '#e6e6e1', accent: '#6b7280', glyph: '🌰' },
  Sprout: { from: '#ecfdf5', to: '#d1fae5', accent: '#059669', glyph: '🌱' },
  Bloom: { from: '#fdf2f8', to: '#fce7f3', accent: '#db2777', glyph: '🌸' },
  Guardian: { from: '#eef2ff', to: '#e0e7ff', accent: '#4f46e5', glyph: '🛡️' },
  Sovereign: { from: '#1d1d1f', to: '#3f3f46', accent: '#fbbf24', glyph: '👑' },
}
