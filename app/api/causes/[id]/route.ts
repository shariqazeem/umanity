import { NextRequest } from 'next/server'
import { ok, fail, isPubkey } from '@/lib/api'
import { getCauseDetail } from '@/lib/data/causes'
import { getCause } from '@/lib/causes'
import { syncPoolsFromChain } from '@/lib/solana/sync'

export const runtime = 'nodejs'

/** GET /api/causes/[id]?viewer= → CauseDetail (lib/contracts.ts). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!getCause(id)) return fail('Cause not found', 404)
  const viewer = req.nextUrl.searchParams.get('viewer')
  const detail = await getCauseDetail(id, isPubkey(viewer) ? viewer : null)
  if (!detail) {
    await syncPoolsFromChain(4000)
    const again = await getCauseDetail(id, isPubkey(viewer) ? viewer : null)
    if (!again) return fail('Cause not initialised yet; run the bootstrap', 404)
    return ok({ cause: again })
  }
  if (!detail.pool.lastSyncedAt || Date.now() - new Date(detail.pool.lastSyncedAt).getTime() > 60_000) syncPoolsFromChain(4000).catch(() => {})
  return ok({ cause: detail })
}
