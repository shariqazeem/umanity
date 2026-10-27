import { ok } from '@/lib/api'
import { getLeaderboard } from '@/lib/data/donations'
import { dareChampions } from '@/lib/data/dares'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const [lb, champions] = await Promise.all([getLeaderboard(10), dareChampions(10)])
    return ok({ leaderboards: { ...lb, dareChampions: champions } })
  } catch {
    return ok({ leaderboards: { topDonors: [], topEarners: [], streakLeaders: [], dareChampions: [] } })
  }
}
