import { desc, eq } from 'drizzle-orm'
import { getDb, newId, intents, x402Receipts, routedTransfers, type Intent } from '@/lib/db'

export async function createIntentRecord(input: Omit<typeof intents.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Intent> {
  const db = await getDb()
  const rows = await db.insert(intents).values({ id: newId('int'), ...input }).returning()
  return rows[0]
}

export async function updateIntent(id: string, patch: Partial<typeof intents.$inferInsert>): Promise<Intent | null> {
  const db = await getDb()
  const rows = await db.update(intents).set({ ...patch, updatedAt: new Date() }).where(eq(intents.id, id)).returning()
  return rows[0] ?? null
}

export async function getIntent(id: string): Promise<Intent | null> {
  const db = await getDb()
  const rows = await db.select().from(intents).where(eq(intents.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getIntentByDepositAddress(depositAddress: string): Promise<Intent | null> {
  const db = await getDb()
  const rows = await db.select().from(intents).where(eq(intents.depositAddress, depositAddress)).limit(1)
  return rows[0] ?? null
}

export async function getIntentsForUser(userAddress: string, limit = 20): Promise<Intent[]> {
  const db = await getDb()
  return db.select().from(intents).where(eq(intents.userAddress, userAddress)).orderBy(desc(intents.createdAt)).limit(limit)
}

export async function getRecentIntents(limit = 20): Promise<Intent[]> {
  const db = await getDb()
  return db.select().from(intents).orderBy(desc(intents.createdAt)).limit(limit)
}

export async function recordX402Receipt(input: Omit<typeof x402Receipts.$inferInsert, 'id' | 'createdAt'>) {
  const db = await getDb()
  const rows = await db.insert(x402Receipts).values({ id: newId('x402'), ...input }).returning()
  return rows[0]
}

export async function updateX402Receipt(id: string, patch: Partial<typeof x402Receipts.$inferInsert>) {
  const db = await getDb()
  await db.update(x402Receipts).set(patch).where(eq(x402Receipts.id, id))
}

export async function getX402Receipts(limit = 20) {
  const db = await getDb()
  return db.select().from(x402Receipts).orderBy(desc(x402Receipts.createdAt)).limit(limit)
}

export async function createRoutedTransfer(input: Omit<typeof routedTransfers.$inferInsert, 'id' | 'createdAt'>) {
  const db = await getDb()
  const rows = await db.insert(routedTransfers).values({ id: newId('rt'), ...input }).returning()
  return rows[0]
}

export async function updateRoutedTransfer(id: string, patch: Partial<typeof routedTransfers.$inferInsert>) {
  const db = await getDb()
  const rows = await db.update(routedTransfers).set(patch).where(eq(routedTransfers.id, id)).returning()
  return rows[0] ?? null
}

export async function getRoutedTransfer(id: string) {
  const db = await getDb()
  const rows = await db.select().from(routedTransfers).where(eq(routedTransfers.id, id)).limit(1)
  return rows[0] ?? null
}
