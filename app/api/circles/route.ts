/** The Hundred: every Circle handed out so far, for the Circles page. Art only for minted Circles. */
import { NextResponse } from 'next/server'
import { getDb, users } from '@/lib/db'
import { inArray } from 'drizzle-orm'
import { CIRCLES_COLLECTION, CIRCLES_LIMIT, circleName, circleScene, isCirclesOn, listCircles } from '@/lib/umanity/circles'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isCirclesOn()) return NextResponse.json({ on: false, limit: CIRCLES_LIMIT, circles: [] })
  const rows = await listCircles()
  const db = await getDb()
  const named = rows.length ? await db.select({ address: users.address, username: users.username }).from(users).where(inArray(users.address, rows.map((r) => r.owner))) : []
  const byAddress = new Map(named.map((n) => [n.address, n.username]))
  return NextResponse.json({
    on: true,
    limit: CIRCLES_LIMIT,
    collection: CIRCLES_COLLECTION,
    circles: rows.map((r) => ({
      number: r.number,
      name: circleName(r.number),
      owner: r.owner,
      username: byAddress.get(r.owner) ?? null,
      minted: r.status === 'minted',
      frozen: r.frozen,
      asset: r.status === 'minted' ? r.asset : null,
      scene: r.status === 'minted' ? circleScene(r.number) : null,
      at: (r.mintedAt ?? r.createdAt).toISOString(),
    })),
  })
}
