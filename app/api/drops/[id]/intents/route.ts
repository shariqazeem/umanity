/**
 * POST /api/drops/[id]/intents — a gift into this drop from any chain (Aurora Intents).
 *   { originAsset, amountUsd, live?, refundTo?, backer? }
 * Without `live` it's a free price preview. With `live` (mainnet) it opens a
 * one-off deposit address; GET /api/drops/intents/[intent] tracks it into the pot.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { clientIp, isPubkey, rateLimit } from '@/lib/api'
import { getConnection } from '@/lib/solana/chain'
import { quoteDropGift } from '@/lib/umanity/intents'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dropId = Number((await params).id)
  if (!Number.isInteger(dropId) || dropId < 0) return NextResponse.json({ error: 'Unknown drop' }, { status: 404 })
  const b = (await req.json().catch(() => ({}))) as { originAsset?: string; amountUsd?: number; live?: boolean; refundTo?: string; backer?: string }
  if (!b.originAsset || !Number.isFinite(Number(b.amountUsd))) return NextResponse.json({ error: 'Pick an asset and an amount' }, { status: 400 })
  if (b.backer && !isPubkey(b.backer)) return NextResponse.json({ error: 'Bad wallet address' }, { status: 400 })
  if (b.live && !rateLimit(`drop-intent:${clientIp(req)}`, 20, 3600_000)) return NextResponse.json({ error: 'Too many deposit addresses; try again in a bit' }, { status: 429 })
  try {
    const quote = await quoteDropGift(getConnection(), {
      dropId,
      originAsset: b.originAsset,
      amountUsd: Number(b.amountUsd),
      live: !!b.live,
      refundTo: typeof b.refundTo === 'string' ? b.refundTo.slice(0, 200) : undefined,
      backer: b.backer,
    })
    return NextResponse.json({ quote })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.replace(/^Intents API: /, '') }, { status: 400 })
  }
}
