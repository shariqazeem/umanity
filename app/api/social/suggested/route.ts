import { NextRequest } from 'next/server'
import { ok, resolveUser } from '@/lib/api'
import { suggestedUsers, toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  const users = await suggestedUsers(user?.address ?? null, Number(q.get('limit') || 8))
  return ok({ profiles: users.map(toPublicUser) })
}
