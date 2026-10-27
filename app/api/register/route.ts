import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, errorMessage } from '@/lib/api'
import { claimHandle, toPublicUser, getAllUsers, USERNAME_RE, findUserByUsername } from '@/lib/data/users'
import { follow } from '@/lib/data/social'

export const runtime = 'nodejs'

/**
 * POST /api/register { address, username, displayName?, bio?, referredBy?, follow?: string[] }
 * Claims a handle for a wallet (creates the profile if needed). Idempotent.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; displayName?: string; bio?: string; referredBy?: string; follow?: string[] }>(req)
  if (!isPubkey(body.address)) return fail('Valid Solana address required')
  const username = (body.username || '').toLowerCase().trim()
  if (!USERNAME_RE.test(username)) return fail('Username must be 3-30 characters: lowercase letters, numbers, underscores')
  try {
    const res = await claimHandle(body.address, username, body.displayName, body.bio)
    if (res.error || !res.user) return fail(res.error || 'Could not claim handle')
    if (Array.isArray(body.follow)) {
      for (const handle of body.follow.slice(0, 20)) {
        const target = await findUserByUsername(String(handle))
        if (target) await follow(res.user.address, target.address).catch(() => {})
      }
    }
    if (body.referredBy) {
      const ref = await findUserByUsername(body.referredBy)
      if (ref && ref.address !== res.user.address) await follow(res.user.address, ref.address).catch(() => {})
    }
    return ok({ user: toPublicUser(res.user), message: 'Handle claimed. +50 impact points.' })
  } catch (e) {
    return fail(errorMessage(e), 500)
  }
}

export async function GET() {
  const users = await getAllUsers(100)
  return ok({ users: users.map((u) => ({ ...toPublicUser(u), addressPreview: `${u.address.slice(0, 4)}…${u.address.slice(-4)}` })), totalUsers: users.length })
}
