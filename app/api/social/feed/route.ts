import { NextRequest } from 'next/server'
import { ok, resolveUser } from '@/lib/api'
import { getGlobalFeed, getPostsByAuthor, getNetworkFeed } from '@/lib/data/social'

export const runtime = 'nodejs'

/**
 * GET /api/social/feed?[username=|address=]&[viewer=]&[scope=global|network]&[limit=]
 * Without username/address: the global stream. With: that author's posts.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const viewer = q.get('viewer')
  const limit = Math.min(100, Number(q.get('limit') || 30))
  try {
    if (q.get('username') || q.get('address')) {
      const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
      if (!user) return ok({ posts: [] })
      return ok({ posts: await getPostsByAuthor(user.address, limit, viewer) })
    }
    if (q.get('scope') === 'network' && viewer) return ok({ posts: await getNetworkFeed(viewer, limit) })
    return ok({ posts: await getGlobalFeed(limit, viewer) })
  } catch {
    return ok({ posts: [] })
  }
}
