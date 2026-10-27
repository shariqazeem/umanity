import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb, newId, posts, likes, comments, follows, users, notifications, type Post, type User } from '@/lib/db'
import { findUser, findUsersByAddresses, toPublicUser } from './users'

export type PostType = 'manual' | 'donation' | 'milestone' | 'joined' | 'impact_dare' | 'dare_accepted' | 'intent' | 'proof' | 'vote' | 'field_update'

export interface FeedPost {
  id: string
  type: PostType
  username: string
  displayName: string
  address: string
  avatarUrl: string | null
  content: string
  properties: Record<string, string>
  txSignature: string | null
  likeCount: number
  commentCount: number
  liked?: boolean
  createdAt: string
}

export async function hydratePosts(rows: Post[], viewerAddress?: string | null): Promise<FeedPost[]> {
  if (rows.length === 0) return []
  const authors = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.authorAddress))))
  let likedSet = new Set<string>()
  if (viewerAddress) {
    const db = await getDb()
    const likedRows = await db
      .select({ postId: likes.postId })
      .from(likes)
      .where(and(eq(likes.userAddress, viewerAddress), inArray(likes.postId, rows.map((r) => r.id))))
    likedSet = new Set(likedRows.map((r) => r.postId))
  }
  return rows.map((r) => {
    const a = authors.get(r.authorAddress)
    return {
      id: r.id,
      type: r.type as PostType,
      username: a?.username ?? `${r.authorAddress.slice(0, 4)}…${r.authorAddress.slice(-4)}`,
      displayName: a?.displayName ?? '',
      address: r.authorAddress,
      avatarUrl: a?.avatarUrl ?? null,
      content: r.content,
      properties: r.properties ?? {},
      txSignature: r.txSignature ?? null,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      liked: likedSet.has(r.id),
      createdAt: r.createdAt.toISOString(),
    }
  })
}

export async function createPost(authorAddress: string, content: string, type: PostType = 'manual', properties: Record<string, string> = {}, txSignature?: string): Promise<Post> {
  const db = await getDb()
  const rows = await db
    .insert(posts)
    .values({ id: newId('post'), authorAddress, content, type, properties, txSignature: txSignature ?? null })
    .returning()
  return rows[0]
}

export async function getGlobalFeed(limit = 30, viewerAddress?: string | null, before?: Date): Promise<FeedPost[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(posts)
    .where(before ? sql`${posts.createdAt} < ${before}` : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
  return hydratePosts(rows, viewerAddress)
}

/** Posts from accounts the viewer follows (plus their own). */
export async function getNetworkFeed(viewerAddress: string, limit = 30): Promise<FeedPost[]> {
  const db = await getDb()
  const following = await db.select({ f: follows.followeeAddress }).from(follows).where(eq(follows.followerAddress, viewerAddress))
  const addrs = [viewerAddress, ...following.map((r) => r.f)]
  const rows = await db.select().from(posts).where(inArray(posts.authorAddress, addrs)).orderBy(desc(posts.createdAt)).limit(limit)
  return hydratePosts(rows, viewerAddress)
}

export async function getPostsByAuthor(address: string, limit = 50, viewerAddress?: string | null): Promise<FeedPost[]> {
  const db = await getDb()
  const rows = await db.select().from(posts).where(eq(posts.authorAddress, address)).orderBy(desc(posts.createdAt)).limit(limit)
  return hydratePosts(rows, viewerAddress)
}

export async function getTrendingPosts(limit = 5, viewerAddress?: string | null): Promise<FeedPost[]> {
  const db = await getDb()
  const since = new Date(Date.now() - 14 * 86_400_000)
  const rows = await db
    .select()
    .from(posts)
    .where(sql`${posts.createdAt} >= ${since}`)
    .orderBy(desc(sql`${posts.likeCount} * 3 + ${posts.commentCount} * 2`), desc(posts.createdAt))
    .limit(limit)
  return hydratePosts(rows, viewerAddress)
}

export async function getPost(id: string, viewerAddress?: string | null): Promise<FeedPost | null> {
  const db = await getDb()
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!rows[0]) return null
  return (await hydratePosts(rows, viewerAddress))[0]
}

// ---- Likes ----
export async function likePost(postId: string, userAddress: string): Promise<{ liked: boolean; likeCount: number }> {
  const db = await getDb()
  const inserted = await db.insert(likes).values({ postId, userAddress }).onConflictDoNothing().returning()
  if (inserted.length) {
    const rows = await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, postId)).returning()
    return { liked: true, likeCount: rows[0]?.likeCount ?? 0 }
  }
  const rows = await db.select({ likeCount: posts.likeCount }).from(posts).where(eq(posts.id, postId))
  return { liked: true, likeCount: rows[0]?.likeCount ?? 0 }
}

export async function unlikePost(postId: string, userAddress: string): Promise<{ liked: boolean; likeCount: number }> {
  const db = await getDb()
  const deleted = await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userAddress, userAddress))).returning()
  if (deleted.length) {
    const rows = await db.update(posts).set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)` }).where(eq(posts.id, postId)).returning()
    return { liked: false, likeCount: rows[0]?.likeCount ?? 0 }
  }
  const rows = await db.select({ likeCount: posts.likeCount }).from(posts).where(eq(posts.id, postId))
  return { liked: false, likeCount: rows[0]?.likeCount ?? 0 }
}

export async function hasLiked(postId: string, userAddress: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db.select({ postId: likes.postId }).from(likes).where(and(eq(likes.postId, postId), eq(likes.userAddress, userAddress))).limit(1)
  return rows.length > 0
}

// ---- Comments ----
export interface CommentView {
  id: string
  postId: string
  username: string
  displayName: string
  address: string
  text: string
  createdAt: string
}

export async function addComment(postId: string, authorAddress: string, text: string): Promise<CommentView> {
  const db = await getDb()
  const rows = await db.insert(comments).values({ id: newId('c'), postId, authorAddress, text }).returning()
  await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId))
  const author = await findUser(authorAddress)
  const c = rows[0]
  return { id: c.id, postId, username: author?.username ?? '', displayName: author?.displayName ?? '', address: authorAddress, text: c.text, createdAt: c.createdAt.toISOString() }
}

export async function getComments(postId: string): Promise<CommentView[]> {
  const db = await getDb()
  const rows = await db.select().from(comments).where(eq(comments.postId, postId)).orderBy(comments.createdAt)
  const authors = await findUsersByAddresses(Array.from(new Set(rows.map((r) => r.authorAddress))))
  return rows.map((c) => {
    const a = authors.get(c.authorAddress)
    return { id: c.id, postId, username: a?.username ?? '', displayName: a?.displayName ?? '', address: c.authorAddress, text: c.text, createdAt: c.createdAt.toISOString() }
  })
}

// ---- Follows ----
export async function follow(followerAddress: string, followeeAddress: string) {
  if (followerAddress === followeeAddress) return
  const db = await getDb()
  await db.insert(follows).values({ followerAddress, followeeAddress }).onConflictDoNothing()
}

export async function unfollow(followerAddress: string, followeeAddress: string) {
  const db = await getDb()
  await db.delete(follows).where(and(eq(follows.followerAddress, followerAddress), eq(follows.followeeAddress, followeeAddress)))
}

export async function isFollowing(followerAddress: string, followeeAddress: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db
    .select({ f: follows.followerAddress })
    .from(follows)
    .where(and(eq(follows.followerAddress, followerAddress), eq(follows.followeeAddress, followeeAddress)))
    .limit(1)
  return rows.length > 0
}

export async function getFollowers(address: string): Promise<User[]> {
  const db = await getDb()
  const rows = await db
    .select({ u: users })
    .from(follows)
    .innerJoin(users, eq(users.address, follows.followerAddress))
    .where(eq(follows.followeeAddress, address))
    .orderBy(desc(follows.createdAt))
  return rows.map((r) => r.u)
}

export async function getFollowing(address: string): Promise<User[]> {
  const db = await getDb()
  const rows = await db
    .select({ u: users })
    .from(follows)
    .innerJoin(users, eq(users.address, follows.followeeAddress))
    .where(eq(follows.followerAddress, address))
    .orderBy(desc(follows.createdAt))
  return rows.map((r) => r.u)
}

export async function followCounts(address: string): Promise<{ followers: number; following: number }> {
  const db = await getDb()
  const [f1] = await db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followeeAddress, address))
  const [f2] = await db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerAddress, address))
  return { followers: f1?.n ?? 0, following: f2?.n ?? 0 }
}

/** Which of the viewer's followings donated to a given pool (social proof). */
export async function followingWhoDonated(viewerAddress: string, poolId: string): Promise<string[]> {
  const db = await getDb()
  const { donations } = await import('@/lib/db')
  const rows = await db
    .selectDistinct({ username: users.username })
    .from(follows)
    .innerJoin(donations, eq(donations.donorAddress, follows.followeeAddress))
    .innerJoin(users, eq(users.address, follows.followeeAddress))
    .where(and(eq(follows.followerAddress, viewerAddress), eq(donations.poolId, poolId)))
    .limit(5)
  return rows.map((r) => r.username)
}

// ---- Notifications ----
export async function notify(recipientAddress: string, type: string, message: string, fromUsername?: string) {
  const db = await getDb()
  await db.insert(notifications).values({ id: newId('n'), recipientAddress, type, message, fromUsername: fromUsername ?? null })
}

export async function notifyMany(rows: { recipientAddress: string; type: string; message: string; fromUsername?: string }[]) {
  if (!rows.length) return
  const db = await getDb()
  await db.insert(notifications).values(rows.map((r) => ({ id: newId('n'), recipientAddress: r.recipientAddress, type: r.type, message: r.message, fromUsername: r.fromUsername ?? null })))
}

export async function getNotifications(address: string, limit = 50) {
  const db = await getDb()
  const rows = await db.select().from(notifications).where(eq(notifications.recipientAddress, address)).orderBy(desc(notifications.createdAt)).limit(limit)
  return rows.map((n) => ({ id: n.id, type: n.type, message: n.message, from_username: n.fromUsername, created_at: n.createdAt.toISOString(), read: n.read }))
}

export async function markNotificationsRead(address: string) {
  const db = await getDb()
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.recipientAddress, address), eq(notifications.read, false)))
}

export { toPublicUser }
