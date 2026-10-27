import { NextRequest } from 'next/server'
import { ok, fail, errorMessage } from '@/lib/api'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { bootstrapCauses } from '@/lib/solana/bootstrap'

export const runtime = 'nodejs'
export const maxDuration = 300

/** POST /api/admin/bootstrap (admin) — creates missing pools, campaigns and milestones on-chain for every cause. */
export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return fail(auth.error || 'Unauthorized', 401)
  const log: string[] = []
  try {
    const steps = await bootstrapCauses((l) => log.push(l))
    return ok({ steps, log })
  } catch (e) {
    return fail(errorMessage(e), 500, { log })
  }
}
