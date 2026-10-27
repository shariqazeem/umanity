import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { ok, resolveUser } from '@/lib/api'
import { getDb, votes } from '@/lib/db'
import { followCounts } from '@/lib/data/social'
import { guardianFor } from '@/lib/guardian'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/** GET /api/impact-score?address= — Living Guardian state + breakdown. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const user = await resolveUser({ address: q.get('address'), username: q.get('username') })
  if (!user) return ok({ guardian: guardianFor({ rewardPoints: 0, streakCurrent: 0, donationCount: 0 }), breakdown: null })
  const db = await getDb()
  const [v] = await db.select({ n: sql<number>`count(*)::int` }).from(votes).where(eq(votes.voterAddress, user.address))
  const counts = await followCounts(user.address)
  const guardian = guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount, votes: v?.n ?? 0 })
  return ok({
    guardian,
    tier: guardian.tier,
    total: guardian.score,
    breakdown: {
      points: user.rewardPoints,
      donated: user.totalDonatedLamports / LAMPORTS_PER_SOL,
      donations: user.donationCount,
      streak: user.streakCurrent,
      longestStreak: user.streakLongest,
      votes: v?.n ?? 0,
      followers: counts.followers,
      following: counts.following,
    },
  })
}
