import { NextRequest } from 'next/server'
import { ok, fail, readJson, resolveUser, errorMessage } from '@/lib/api'
import { createPost, getPostsByAuthor, hydratePosts, type PostType } from '@/lib/data/social'

export const runtime = 'nodejs'

const ALLOWED: PostType[] = ['manual', 'proof']

/** POST /api/social/post { address | username, content, properties? } */
export async function POST(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; content?: string; properties?: Record<string, string> }>(req)
  const content = (body.content || '').trim()
  if (!content || content.length > 500) return fail('Content must be 1-500 characters')
  const user = await resolveUser({ address: body.address, username: body.username }, { create: true })
  if (!user) return fail('Profile not found', 404)
  try {
    const requested = (body.properties?.type as PostType) || 'manual'
    const type: PostType = ALLOWED.includes(requested) ? requested : 'manual'
    const post = await createPost(user.address, content, type, body.properties ?? {})
    const [view] = await hydratePosts([post], user.address)
    return ok({ post: view })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!user) return ok({ posts: [] })
  return ok({ posts: await getPostsByAuthor(user.address, 50, q.get('viewer')) })
}
