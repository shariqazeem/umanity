import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { ok, resolveUser } from '@/lib/api'
import { getDb, users } from '@/lib/db'
import { toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!user) return ok({ referrals: [] })
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.referredBy, user.username))
  return ok({ referrals: rows.map(toPublicUser) })
}
