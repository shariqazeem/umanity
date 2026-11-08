/**
 * GET  /api/drops/intents/[intent] — where a cross-chain gift is: waiting for the
 *      deposit, swapping, in the pot (with its Solana transaction), or refunded.
 * POST /api/drops/intents/[intent] { txHash } — tell NEAR Intents about the
 *      deposit transaction so the swap starts sooner (optional).
 */
import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/chain'
import { getIntent } from '@/lib/data/intents'
import { submitDeposit } from '@/lib/intents/oneclick'
import { intentView, refreshDropIntent } from '@/lib/umanity/intents'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: Promise<{ intent: string }> }) {
  const id = (await params).intent
  const r = await refreshDropIntent(getConnection(), id).catch((e) => ({ intent: null, error: (e as Error).message }))
  if (!r?.intent) return NextResponse.json({ error: r?.error || 'Unknown gift' }, { status: 404 })
  return NextResponse.json({ intent: intentView(r.intent), error: r.error ?? null })
}

export async function POST(req: Request, { params }: { params: Promise<{ intent: string }> }) {
  const intent = await getIntent((await params).intent)
  if (!intent?.depositAddress || intent.dropId == null) return NextResponse.json({ error: 'Unknown gift' }, { status: 404 })
  const { txHash } = (await req.json().catch(() => ({}))) as { txHash?: string }
  if (!txHash || txHash.length > 200) return NextResponse.json({ error: 'Paste the deposit transaction hash' }, { status: 400 })
  try {
    await submitDeposit(intent.depositAddress, txHash.trim(), intent.depositMemo ?? undefined)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.replace(/^Intents API: /, '') }, { status: 400 })
  }
}
