import { NextRequest } from 'next/server'
import { ok, resolveUser } from '@/lib/api'
import { followingWhoDonated } from '@/lib/data/social'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const poolId = q.get('poolId')
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!user || !poolId) return ok({ matchedUsernames: [], totalMatched: 0 })
  const names = await followingWhoDonated(user.address, poolId)
  return ok({ matchedUsernames: names, totalMatched: names.length })
}
