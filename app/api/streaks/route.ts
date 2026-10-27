import { NextRequest } from 'next/server'
import { ok, isPubkey } from '@/lib/api'
import { findUser, donationDays } from '@/lib/data/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const empty = { currentStreak: 0, longestStreak: 0, lastDonationDate: null, totalDays: 0, donationDays: [] as string[] }
  if (!isPubkey(address)) return ok(empty)
  const user = await findUser(address)
  if (!user) return ok(empty)
  const days = await donationDays(address, 7)
  return ok({ currentStreak: user.streakCurrent, longestStreak: user.streakLongest, lastDonationDate: user.streakLastDate, totalDays: user.donationCount, donationDays: days })
}
