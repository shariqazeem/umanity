import { NextRequest } from 'next/server'
import { ok, fail, readJson, resolveUser } from '@/lib/api'
import { updateProfile, toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

/** PUT /api/social/profile/update { address | username, displayName?, bio?, avatarUrl? } */
export async function PUT(req: NextRequest) {
  const body = await readJson<{ address?: string; username?: string; displayName?: string; bio?: string; avatarUrl?: string }>(req)
  const user = await resolveUser({ address: body.address, username: body.username })
  if (!user) return fail('Profile not found', 404)
  const patch: { displayName?: string; bio?: string; avatarUrl?: string } = {}
  if (typeof body.displayName === 'string') patch.displayName = body.displayName.slice(0, 50)
  if (typeof body.bio === 'string') patch.bio = body.bio.slice(0, 280)
  if (typeof body.avatarUrl === 'string') patch.avatarUrl = body.avatarUrl.slice(0, 500)
  const updated = await updateProfile(user.address, patch)
  return ok({ user: updated ? toPublicUser(updated) : toPublicUser(user) })
}

export const POST = PUT
