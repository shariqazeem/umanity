import { ok } from '@/lib/api'
import { getCampaigns } from '@/lib/data/governance'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return ok({ campaigns: await getCampaigns() })
  } catch {
    return ok({ campaigns: [] })
  }
}
