import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { getCampaigns } from '@/lib/data/governance'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const all = await getCampaigns()
  const c = all.find((x) => x.id === id || x.pool_id === id)
  if (!c) return fail('Campaign not found', 404)
  return ok({ campaign: c, milestones: c.milestones })
}
