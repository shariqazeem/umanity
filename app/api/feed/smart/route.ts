import { NextRequest } from 'next/server'
import { ok, resolveUser } from '@/lib/api'
import { getGlobalFeed, getNetworkFeed, getTrendingPosts, type FeedPost } from '@/lib/data/social'
import { suggestedUsers, toPublicUser } from '@/lib/data/users'
import { getDares, type DareView } from '@/lib/data/dares'
import { getProposals, type ProposalView } from '@/lib/data/governance'

export const runtime = 'nodejs'

export type FeedItem =
  | { type: 'post'; id: string; timestamp: string; data: FeedPost }
  | { type: 'dare'; id: string; timestamp: string; data: DareView }
  | { type: 'proposal'; id: string; timestamp: string; data: ProposalView }
  | { type: 'suggested_follow'; id: string; timestamp?: string; data: ReturnType<typeof toPublicUser> }

/**
 * GET /api/feed/smart?[address=|username=]
 * Mixed stream: network posts (falls back to global), open dares, active
 * fund-release proposals, and a few people to follow. Never empty if the
 * database has anything in it.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const viewer = await resolveUser({ address: q.get('address'), username: q.get('username') })
  const viewerAddress = viewer?.address ?? null
  const items: FeedItem[] = []
  try {
    let posts: FeedPost[] = viewerAddress ? await getNetworkFeed(viewerAddress, 25) : []
    if (posts.length < 8) {
      const global = await getGlobalFeed(30, viewerAddress)
      const seen = new Set(posts.map((p) => p.id))
      posts = [...posts, ...global.filter((p) => !seen.has(p.id))]
    }
    for (const p of posts) items.push({ type: 'post', id: p.id, timestamp: p.createdAt, data: p })

    const trending = await getTrendingPosts(3, viewerAddress)
    for (const p of trending) if (!items.some((i) => i.id === p.id)) items.push({ type: 'post', id: p.id, timestamp: p.createdAt, data: p })

    const dares = await getDares({ status: 'open', limit: 5 })
    for (const d of dares) items.push({ type: 'dare', id: `dare_${d.id}`, timestamp: d.createdAt, data: d })

    const proposals = (await getProposals({ status: 'active' })).slice(0, 3)
    for (const p of proposals) items.push({ type: 'proposal', id: `proposal_${p.id}`, timestamp: p.created_at, data: p })
  } catch (e) {
    console.error('smart feed error', e)
  }

  items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))

  // Pin open dares and live proposals near the top, then interleave a suggestion.
  const pinned = items.filter((i) => i.type === 'dare' || i.type === 'proposal').slice(0, 2)
  const pinnedIds = new Set(pinned.map((i) => i.id))
  const rest = items.filter((i) => !pinnedIds.has(i.id))
  const final: FeedItem[] = [...pinned, ...rest]
  try {
    const sugg = await suggestedUsers(viewerAddress, 3)
    const insertAt = Math.min(5, final.length)
    final.splice(insertAt, 0, ...sugg.map((u) => ({ type: 'suggested_follow' as const, id: `suggest_${u.address}`, data: toPublicUser(u) })))
  } catch {
    /* ignore */
  }
  return ok({ feed: final, total: final.length })
}
