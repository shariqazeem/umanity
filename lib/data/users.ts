import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { getDb, users, follows, donations, type User } from '@/lib/db'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

/** Shape returned to the frontend (keeps the old camelCase contract). */
export interface PublicUser {
  address: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  rewardPoints: number
  totalDonated: number // SOL
  donationCount: number
  tipCountSent: number
  tipCountReceived: number
  handleClaimed: boolean
  streakCurrent: number
  streakLongest: number
  referredBy: string | null
  createdAt: string
  isActive: boolean
}

export function toPublicUser(u: User): PublicUser {
  return {
    address: u.address,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: u.avatarUrl ?? null,
    rewardPoints: u.rewardPoints,
    totalDonated: u.totalDonatedLamports / LAMPORTS_PER_SOL,
    donationCount: u.donationCount,
    tipCountSent: u.tipCountSent,
    tipCountReceived: u.tipCountReceived,
    handleClaimed: u.handleClaimed,
    streakCurrent: u.streakCurrent,
    streakLongest: u.streakLongest,
    referredBy: u.referredBy ?? null,
    createdAt: u.createdAt.toISOString(),
    isActive: u.isActive,
  }
}

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/

export async function findUser(address: string): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.address, address)).limit(1)
  return rows[0] ?? null
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1)
  return rows[0] ?? null
}

export async function findUsersByAddresses(addresses: string[]): Promise<Map<string, User>> {
  if (addresses.length === 0) return new Map()
  const db = await getDb()
  const rows = await db.select().from(users).where(sql`${users.address} in ${addresses}`)
  return new Map(rows.map((r) => [r.address, r]))
}

/** Deterministic, collision-resistant default handle: user_<first 4><last 2> of the wallet. */
export function defaultHandleFor(address: string): string {
  return `user_${address.slice(0, 4)}${address.slice(-2)}`.toLowerCase().replace(/[^a-z0-9_]/g, '')
}

/**
 * Guarantees a profile exists for a wallet. Never throws on duplicate handles:
 * if the preferred handle is taken, falls back to a wallet-derived one.
 */
export async function ensureUser(address: string, preferred?: { username?: string; displayName?: string; bio?: string; referredBy?: string }): Promise<User> {
  const existing = await findUser(address)
  if (existing) return existing

  const db = await getDb()
  const candidates = [preferred?.username?.toLowerCase(), defaultHandleFor(address), `${defaultHandleFor(address)}_${Math.floor(Math.random() * 1000)}`].filter(Boolean) as string[]

  for (const username of candidates) {
    if (!USERNAME_RE.test(username)) continue
    try {
      const inserted = await db
        .insert(users)
        .values({
          address,
          username,
          displayName: preferred?.displayName || (preferred?.username ? preferred.username : `${address.slice(0, 4)}…${address.slice(-4)}`),
          bio: preferred?.bio || '',
          rewardPoints: 50, // welcome bonus
          handleClaimed: !!preferred?.username,
          referredBy: preferred?.referredBy || null,
        })
        .onConflictDoNothing({ target: users.address })
        .returning()
      if (inserted[0]) return inserted[0]
      // Race: someone inserted this address concurrently
      const again = await findUser(address)
      if (again) return again
    } catch (err: unknown) {
      // Username unique violation -> try next candidate
      const msg = err instanceof Error ? err.message : String(err)
      if (!/unique|duplicate/i.test(msg)) throw err
    }
  }
  // Last resort: random suffix loop
  for (let i = 0; i < 5; i++) {
    const username = `user_${Math.random().toString(36).slice(2, 10)}`
    try {
      const inserted = await db.insert(users).values({ address, username, displayName: username, rewardPoints: 50 }).returning()
      if (inserted[0]) return inserted[0]
    } catch {
      /* retry */
    }
  }
  throw new Error('Could not allocate a username')
}

export async function claimHandle(address: string, username: string, displayName?: string, bio?: string): Promise<{ user?: User; error?: string }> {
  const uname = username.toLowerCase()
  if (!USERNAME_RE.test(uname)) return { error: 'Username must be 3-30 chars: a-z, 0-9, _' }
  const taken = await findUserByUsername(uname)
  if (taken && taken.address !== address) return { error: 'Username already taken' }
  const db = await getDb()
  const existing = await ensureUser(address)
  const rows = await db
    .update(users)
    .set({
      username: uname,
      displayName: displayName?.trim() || existing.displayName,
      bio: bio ?? existing.bio,
      handleClaimed: true,
      rewardPoints: existing.handleClaimed ? existing.rewardPoints : existing.rewardPoints + 50,
    })
    .where(eq(users.address, address))
    .returning()
  return { user: rows[0] }
}

export async function updateProfile(address: string, patch: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User | null> {
  const db = await getDb()
  const rows = await db.update(users).set(patch).where(eq(users.address, address)).returning()
  return rows[0] ?? null
}

export async function addPoints(address: string, points: number) {
  const db = await getDb()
  await db.update(users).set({ rewardPoints: sql`${users.rewardPoints} + ${points}` }).where(eq(users.address, address))
}

export async function getAllUsers(limit = 200): Promise<User[]> {
  const db = await getDb()
  return db.select().from(users).where(eq(users.isActive, true)).orderBy(desc(users.createdAt)).limit(limit)
}

export async function searchUsers(query: string, limit = 10): Promise<User[]> {
  const db = await getDb()
  const q = `%${query.toLowerCase()}%`
  return db
    .select()
    .from(users)
    .where(or(ilike(users.username, q), ilike(users.displayName, q)))
    .limit(limit)
}

/** People worth following: most impact points, excluding self and already-followed. */
export async function suggestedUsers(forAddress: string | null, limit = 8): Promise<User[]> {
  const db = await getDb()
  if (!forAddress) {
    return db.select().from(users).where(eq(users.isActive, true)).orderBy(desc(users.rewardPoints)).limit(limit)
  }
  const following = await db.select({ f: follows.followeeAddress }).from(follows).where(eq(follows.followerAddress, forAddress))
  const exclude = new Set([forAddress, ...following.map((r) => r.f)])
  const rows = await db.select().from(users).where(and(eq(users.isActive, true), ne(users.address, forAddress))).orderBy(desc(users.rewardPoints)).limit(limit + exclude.size)
  return rows.filter((r) => !exclude.has(r.address)).slice(0, limit)
}

/** Streak update after a donation (UTC day granularity). Returns the new streak. */
export async function bumpStreak(address: string, at = new Date()): Promise<{ current: number; longest: number }> {
  const db = await getDb()
  const u = await findUser(address)
  if (!u) return { current: 0, longest: 0 }
  const today = at.toISOString().slice(0, 10)
  const yesterday = new Date(at.getTime() - 86_400_000).toISOString().slice(0, 10)
  let current = u.streakCurrent
  if (u.streakLastDate === today) {
    // already counted today
  } else if (u.streakLastDate === yesterday) {
    current = u.streakCurrent + 1
  } else {
    current = 1
  }
  const longest = Math.max(u.streakLongest, current)
  await db.update(users).set({ streakCurrent: current, streakLongest: longest, streakLastDate: today }).where(eq(users.address, address))
  return { current, longest }
}

/** Last 7 UTC days with at least one donation, for the streak calendar. */
export async function donationDays(address: string, days = 7): Promise<string[]> {
  const db = await getDb()
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await db
    .select({ d: sql<string>`to_char(${donations.createdAt} at time zone 'UTC', 'YYYY-MM-DD')` })
    .from(donations)
    .where(and(eq(donations.donorAddress, address), sql`${donations.createdAt} >= ${since}`))
  return Array.from(new Set(rows.map((r) => r.d))).sort()
}
