import { NextRequest } from 'next/server'
import { ok, resolveUser } from '@/lib/api'
import { getGlobalFeed, getNetworkFeed, getTrendingPosts, type FeedPost } from '@/lib/data/social'
import { suggestedUsers, toPublicUser } from '@/lib/data/users'
import { getDares } from '@/lib/data/dares'
import { getProposals } from '@/lib/data/governance'
import { getFieldUpdates } from '@/lib/data/field'
import { donorPoolsGiven } from '@/lib/data/donations'
import { CAUSE_IDS } from '@/lib/causes'
import type { FeedItem } from '@/lib/contracts'

export const runtime = 'nodejs'

/**
 * GET /api/feed/smart?[address=|username=]
 * The home stream: posts from people you follow (global when that is thin),
 * field deliveries, open dares, live release votes and a few people to follow.
 * `fundedByViewer` marks deliveries and proofs for causes the viewer gave to.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const viewer = await resolveUser({ address: q.get('address'), username: q.get('username') })
  const viewerAddress = viewer?.address ?? null
  const items: FeedItem[] = []
  const causeOk = (poolId?: string | null) => !poolId || CAUSE_IDS.includes(poolId)
  try {
    const funded = viewerAddress ? await donorPoolsGiven(viewerAddress).catch(() => new Set<string>()) : new Set<string>()

    let posts: FeedPost[] = viewerAddress ? await getNetworkFeed(viewerAddress, 25) : []
    if (posts.length < 8) {
      const global = await getGlobalFeed(30, viewerAddress)
      const seen = new Set(posts.map((p) => p.id))
      posts = [...posts, ...global.filter((p) => !seen.has(p.id))]
    }
    const trending = await getTrendingPosts(3, viewerAddress)
    for (const p of trending) if (!posts.some((x) => x.id === p.id)) posts.push(p)
    for (const p of posts) {
      if (!causeOk(p.properties.poolId)) continue
      if (p.type === 'field_update') continue // the delivery card below carries it
      const fundedByViewer = p.type === 'proof' && !!p.properties.poolId && funded.has(p.properties.poolId)
      items.push({ type: 'post', id: p.id, timestamp: p.createdAt, data: fundedByViewer ? { ...p, fundedByViewer } : p })
    }

    const updates = await getFieldUpdates({ limit: 20 })
    for (const u of updates) items.push({ type: 'field_update', id: `delivery_${u.id}`, timestamp: u.createdAt, data: funded.has(u.poolId) ? { ...u, fundedByViewer: true } : u })

    const dares = await getDares({ status: 'open', limit: 5 })
    for (const d of dares) if (causeOk(d.poolId)) items.push({ type: 'dare', id: `dare_${d.id}`, timestamp: d.createdAt, data: d })

    const proposals = (await getProposals({ status: 'active' })).filter((p) => causeOk(p.recipient?.pool_id)).slice(0, 3)
    for (const p of proposals) items.push({ type: 'proposal', id: `proposal_${p.id}`, timestamp: p.created_at, data: p })
  } catch (e) {
    console.error('smart feed error', e)
  }

  items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))

  // Live votes and open dares stay at the top; one or two people to follow are slotted in below.
  const pinned = items.filter((i) => i.type === 'proposal' || i.type === 'dare').slice(0, 2)
  const pinnedIds = new Set(pinned.map((i) => i.id))
  const final: FeedItem[] = [...pinned, ...items.filter((i) => !pinnedIds.has(i.id))]
  try {
    const sugg = await suggestedUsers(viewerAddress, 2)
    if (sugg.length) final.splice(Math.min(5, final.length), 0, ...sugg.map((u) => ({ type: 'suggested_follow' as const, id: `suggest_${u.address}`, data: toPublicUser(u) })))
  } catch {
    /* ignore */
  }
  return ok({ feed: final, total: final.length })
}
