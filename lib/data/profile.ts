/** Public profile aggregate (lib/contracts.ts: PublicProfile). */
import { desc, eq, or, sql } from 'drizzle-orm'
import { getDb, votes, dares } from '@/lib/db'
import { findUserByUsername, findUser, toPublicUser } from './users'
import { followCounts, isFollowing, getPostsByAuthor } from './social'
import { getCertificates, getGiftsForDonor, donorCauseTotals, firstGiftRank } from './donations'
import { toDareViews } from './dares'
import { guardianFor } from '@/lib/guardian'
import { CAUSES } from '@/lib/causes'
import type { PublicProfile, CertView } from '@/lib/contracts'

export async function getPublicProfile(handleOrAddress: string, viewer?: string | null): Promise<PublicProfile | null> {
  const user = (await findUserByUsername(handleOrAddress)) ?? (handleOrAddress.length >= 32 ? await findUser(handleOrAddress) : null)
  if (!user) return null
  const db = await getDb()
  const [counts, viewerFollows, certs, gifts, posts, causeTotals, rank, voteRow, dareRows] = await Promise.all([
    followCounts(user.address),
    viewer ? isFollowing(viewer, user.address) : Promise.resolve(false),
    getCertificates(user.address),
    getGiftsForDonor(user.address, 50, viewer),
    getPostsByAuthor(user.address, 30, viewer),
    donorCauseTotals(user.address),
    firstGiftRank(user.address),
    db.select({ n: sql<number>`count(*)::int` }).from(votes).where(eq(votes.voterAddress, user.address)),
    db
      .select()
      .from(dares)
      .where(or(eq(dares.creatorAddress, user.address), eq(dares.targetHandle, user.username)))
      .orderBy(desc(dares.createdAt))
      .limit(20),
  ])
  const voteCount = voteRow[0]?.n ?? 0
  const certificates: CertView[] = certs.map((c) => ({
    id: c.id,
    tier: c.tier,
    causeName: c.cause_name,
    poolId: CAUSES.find((x) => x.name === c.cause_name)?.id ?? '',
    amount: c.amount,
    signature: c.mint_signature,
    createdAt: c.created_at,
  }))
  return {
    ...toPublicUser(user),
    followers: counts.followers,
    following: counts.following,
    viewerFollows,
    guardian: guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount, votes: voteCount }),
    votes: voteCount,
    certificates,
    gifts,
    posts,
    dares: await toDareViews(dareRows),
    causes: causeTotals.map((t) => {
      const c = CAUSES.find((x) => x.id === t.poolId)
      return { poolId: t.poolId, name: c?.name ?? t.poolId, emoji: c?.emoji ?? '', image: c?.image ?? '', amount: t.amount }
    }),
    foundingRank: rank,
  }
}
