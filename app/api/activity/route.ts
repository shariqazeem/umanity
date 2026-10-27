import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { getActivity } from '@/lib/data/donations'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 20))
  try {
    const activities = await getActivity(limit)
    return ok({ activities, total: activities.length })
  } catch {
    return ok({ activities: [], total: 0 })
  }
}
