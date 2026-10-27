import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { ensureUser, toPublicUser } from '@/lib/data/users'
import { createPost } from '@/lib/data/social'

export const runtime = 'nodejs'

/**
 * POST /api/profile/resolve { address, referredBy? }
 * Guarantees a profile for a wallet. Never returns an error for a valid address:
 * if the user is new, a wallet-derived handle is allocated and a "joined" post
 * is created. The client shows a non-blocking "claim your @handle" card.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ address?: string; referredBy?: string }>(req)
  if (!isPubkey(body.address)) return fail('Valid Solana address required')
  try {
    const before = Date.now()
    const user = await ensureUser(body.address, body.referredBy ? { referredBy: body.referredBy } : undefined)
    const created = user.createdAt.getTime() >= before - 1000
    if (created) {
      try {
        await createPost(user.address, 'Joined Umanity. Giving is the content here.', 'joined')
      } catch {
        /* non-blocking */
      }
    }
    return ok({ user: toPublicUser(user), created })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}
