import { NextRequest } from 'next/server'
import { ok, fail, isPubkey } from '@/lib/api'
import { getPublicProfile } from '@/lib/data/profile'

export const runtime = 'nodejs'

/** GET /api/users/[username]?viewer= → PublicProfile (lib/contracts.ts). The username may also be a wallet address. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const viewer = req.nextUrl.searchParams.get('viewer')
  const profile = await getPublicProfile(decodeURIComponent(username).replace(/^@/, ''), isPubkey(viewer) ? viewer : null)
  if (!profile) return fail('Profile not found', 404)
  return ok({ profile })
}
