import { NextRequest } from 'next/server'
import { ok, fail, readJson, resolveUser } from '@/lib/api'
import { likePost, unlikePost, hasLiked } from '@/lib/data/social'

export const runtime = 'nodejs'

/** POST /api/social/like { address | username, contentId | postId } */
export async function POST(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; contentId?: string; postId?: string }>(req)
  const postId = body.postId || body.contentId
  if (!postId) return fail('postId required')
  const user = await resolveUser({ address: body.address, username: body.username }, { create: true })
  if (!user) return fail('Profile not found', 404)
  return ok(await likePost(postId, user.address))
}

export async function DELETE(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; contentId?: string; postId?: string }>(req)
  const postId = body.postId || body.contentId
  if (!postId) return fail('postId required')
  const user = await resolveUser({ address: body.address, username: body.username })
  if (!user) return fail('Profile not found', 404)
  return ok(await unlikePost(postId, user.address))
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const postId = q.get('postId') || q.get('contentId')
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!postId || !user) return ok({ isLiked: false })
  return ok({ isLiked: await hasLiked(postId, user.address) })
}
