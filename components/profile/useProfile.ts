'use client'

/**
 * Loads a public profile. Prefers GET /api/users/[username] (PublicProfile);
 * until that endpoint is live it composes the same shape from the older
 * profile, score, feed and dare endpoints so the screens never go blank.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/lib/client/api'
import { CAUSES, getCause } from '@/lib/causes'
import { guardianFor, type GuardianState } from '@/lib/guardian'
import type { PublicProfile, GiftView, CertView } from '@/lib/contracts'
import type { PublicUser } from '@/lib/data/users'
import type { FeedPost } from '@/lib/data/social'
import type { DareView } from '@/lib/data/dares'

interface LegacyProfile extends PublicUser {
  followers: number
  following: number
  viewerFollows: boolean
  certificates: { id: string; tier: string; cause_name: string; amount: number; mint_signature: string | null; created_at: string }[]
  recentDonations: { id: string; poolId: string; amount: number; signature: string; route: string; sourceChain: string | null; createdAt: string }[]
}

function isProfile(x: unknown): x is PublicProfile {
  return !!x && typeof x === 'object' && typeof (x as PublicProfile).username === 'string' && Array.isArray((x as PublicProfile).gifts)
}

async function loadModern(username: string, viewer: string | null): Promise<PublicProfile | null> {
  try {
    const d = await apiGet<{ success?: boolean; profile?: unknown; user?: unknown; username?: string }>(`/api/users/${encodeURIComponent(username)}?viewer=${viewer ?? ''}`)
    if (d?.success === false) return null
    const p = (d as { profile?: unknown }).profile ?? (d as { user?: unknown }).user ?? d
    return isProfile(p) ? p : null
  } catch {
    return null
  }
}

async function loadLegacy(username: string, viewer: string | null): Promise<PublicProfile | null> {
  const u = encodeURIComponent(username)
  const [sp, score, feed, dares] = await Promise.all([
    apiGet<{ success?: boolean; profile?: LegacyProfile }>(`/api/social/profile?username=${u}&viewer=${viewer ?? ''}`).catch(() => null),
    apiGet<{ guardian?: GuardianState; breakdown?: { votes?: number } | null }>(`/api/impact-score?username=${u}`).catch(() => null),
    apiGet<{ posts?: FeedPost[] }>(`/api/social/feed?username=${u}&limit=50&viewer=${viewer ?? ''}`).catch(() => null),
    apiGet<{ dares?: DareView[] }>(`/api/dares?limit=100`).catch(() => null),
  ])
  const p = sp?.profile
  if (!p || sp?.success === false) return null
  const gifts: GiftView[] = (p.recentDonations ?? []).map((d) => ({
    id: d.id,
    poolId: d.poolId,
    poolName: getCause(d.poolId)?.name ?? d.poolId,
    username: p.username,
    displayName: p.displayName,
    address: p.address,
    avatarUrl: p.avatarUrl,
    amount: d.amount,
    route: d.route,
    sourceChain: d.sourceChain,
    signature: d.signature,
    createdAt: d.createdAt,
    anonymous: false,
  }))
  const byCause = new Map<string, number>()
  for (const g of gifts) byCause.set(g.poolId, (byCause.get(g.poolId) ?? 0) + g.amount)
  const certificates: CertView[] = (p.certificates ?? []).map((c) => {
    const cause = getCauseByName(c.cause_name)
    return { id: c.id, tier: c.tier, causeName: c.cause_name, poolId: cause?.id ?? '', amount: c.amount, signature: c.mint_signature, createdAt: c.created_at }
  })
  return {
    ...p,
    guardian: score?.guardian ?? guardianFor({ rewardPoints: p.rewardPoints, streakCurrent: p.streakCurrent, donationCount: p.donationCount }),
    votes: score?.breakdown?.votes ?? 0,
    certificates,
    gifts,
    posts: feed?.posts ?? [],
    dares: (dares?.dares ?? []).filter((d) => d.creator.username === p.username || d.targetHandle === p.username),
    causes: Array.from(byCause.entries()).map(([poolId, amount]) => {
      const c = getCause(poolId)
      return { poolId, name: c?.name ?? poolId, emoji: c?.emoji ?? '', image: c?.image ?? '', amount }
    }),
  }
}

function getCauseByName(name: string) {
  const n = name.trim().toLowerCase()
  return CAUSES.find((c) => c.name.toLowerCase() === n || c.shortName.toLowerCase() === n || c.id === n)
}

export function useProfile(username: string | null, viewer: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(!!username)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!username) {
      setProfile(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      const modern = await loadModern(username, viewer)
      const p = modern ?? (await loadLegacy(username, viewer).catch(() => null))
      if (!alive) return
      if (p) setProfile(p)
      else setError('Profile not found')
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [username, viewer, tick])

  return { profile, loading, error, reload, setProfile }
}
