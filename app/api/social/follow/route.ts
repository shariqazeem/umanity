import { NextRequest } from 'next/server'
import { ok, fail, readJson, resolveUser } from '@/lib/api'
import { follow, unfollow, isFollowing, getFollowers, getFollowing } from '@/lib/data/social'
import { toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

async function pair(body: Record<string, string | undefined>) {
  const follower = await resolveUser({ address: body.followerAddress || body.follower, username: body.followerId || (body.follower && !body.followerAddress && body.follower.length < 32 ? body.follower : undefined) }, { create: true })
  const followee = await resolveUser({ address: body.followeeAddress || (body.followee && body.followee.length >= 32 ? body.followee : undefined), username: body.followeeId || (body.followee && body.followee.length < 32 ? body.followee : undefined) })
  return { follower, followee }
}

/** POST /api/social/follow { follower|followerAddress|followerId, followee|followeeAddress|followeeId } */
export async function POST(req: NextRequest) {
  const body = await readJson<Record<string, string | undefined>>(req)
  const { follower, followee } = await pair(body)
  if (!follower || !followee) return fail('Both profiles must exist', 404)
  await follow(follower.address, followee.address)
  return ok({ following: true })
}

export async function DELETE(req: NextRequest) {
  const body = await readJson<Record<string, string | undefined>>(req)
  const { follower, followee } = await pair(body)
  if (!follower || !followee) return fail('Both profiles must exist', 404)
  await unfollow(follower.address, followee.address)
  return ok({ following: false })
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const type = q.get('type')
  if (q.get('follower') && q.get('followee')) {
    const a = await resolveUser({ address: q.get('follower')!.length >= 32 ? q.get('follower') : undefined, username: q.get('follower')!.length < 32 ? q.get('follower') : undefined })
    const b = await resolveUser({ address: q.get('followee')!.length >= 32 ? q.get('followee') : undefined, username: q.get('followee')!.length < 32 ? q.get('followee') : undefined })
    if (!a || !b) return ok({ isFollowing: false })
    return ok({ isFollowing: await isFollowing(a.address, b.address) })
  }
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!user) return ok({ followers: [], following: [] })
  if (type === 'followers') return ok({ followers: (await getFollowers(user.address)).map(toPublicUser) })
  if (type === 'following') return ok({ following: (await getFollowing(user.address)).map(toPublicUser) })
  const [followers, following] = await Promise.all([getFollowers(user.address), getFollowing(user.address)])
  return ok({ followers: followers.map(toPublicUser), following: following.map(toPublicUser) })
}
