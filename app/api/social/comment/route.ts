import { NextRequest } from 'next/server'
import { ok, fail, readJson, resolveUser } from '@/lib/api'
import { addComment, getComments } from '@/lib/data/social'

export const runtime = 'nodejs'

/** POST /api/social/comment { address | username, postId | contentId, text } */
export async function POST(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; contentId?: string; postId?: string; text?: string }>(req)
  const postId = body.postId || body.contentId
  const text = (body.text || '').trim()
  if (!postId || !text || text.length > 500) return fail('postId and text (1-500 chars) required')
  const user = await resolveUser({ address: body.address, username: body.username }, { create: true })
  if (!user) return fail('Profile not found', 404)
  return ok({ comment: await addComment(postId, user.address, text) })
}

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('postId') || req.nextUrl.searchParams.get('contentId')
  if (!postId) return fail('postId required')
  return ok({ comments: await getComments(postId) })
}
