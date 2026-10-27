import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { searchUsers, toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 1) return ok({ profiles: [] })
  const users = await searchUsers(q, 10)
  return ok({ profiles: users.map((u) => ({ ...toPublicUser(u), walletAddress: u.address })) })
}
