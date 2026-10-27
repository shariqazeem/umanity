import { NextRequest } from 'next/server'
import { ok, fail, resolveUser } from '@/lib/api'
import { toPublicUser } from '@/lib/data/users'
import { followCounts, isFollowing } from '@/lib/data/social'
import { getCertificates, getDonationsByDonor } from '@/lib/data/donations'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/** GET /api/social/profile?username= | ?walletAddress= [&viewer=] */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const user = await resolveUser({ address: q.get('walletAddress') || q.get('address'), username: q.get('username') })
  if (!user) return fail('Profile not found', 404)
  const viewer = q.get('viewer')
  const [counts, certs, dons] = await Promise.all([followCounts(user.address), getCertificates(user.address), getDonationsByDonor(user.address, 20)])
  const following = viewer ? await isFollowing(viewer, user.address) : false
  return ok({
    profile: {
      ...toPublicUser(user),
      followers: counts.followers,
      following: counts.following,
      viewerFollows: following,
      certificates: certs,
      recentDonations: dons.map((d) => ({ id: d.id, poolId: d.poolId, amount: d.amountLamports / LAMPORTS_PER_SOL, signature: d.signature, route: d.route, sourceChain: d.sourceChain, createdAt: d.createdAt.toISOString() })),
    },
  })
}
