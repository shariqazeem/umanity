import { NextResponse } from 'next/server'
import { tradeToken } from '@/lib/umanity/tokens'
import { swapFeeBps } from '@/lib/umanity/swap'

export const dynamic = 'force-dynamic'

const QUOTE = process.env.JUPITER_API_KEY ? 'https://api.jup.ag/swap/v1/quote' : 'https://lite-api.jup.ag/swap/v1/quote'

/**
 * A live Jupiter quote with Umanity's fee taken out: GET ?from=SOL&to=USDC&amount=1
 * (amount in whole tokens). The fee is in USDC, on whichever side is USDC.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const from = tradeToken(q.get('from') ?? '')
  const to = tradeToken(q.get('to') ?? '')
  const amount = Number(q.get('amount'))
  if (!from || !to || from.mint === to.mint || !(amount > 0)) return NextResponse.json({ error: 'Pick two different tokens and an amount' }, { status: 400 })
  const feeBps = swapFeeBps(from.mint, to.mint)
  const raw = BigInt(Math.round(amount * 10 ** from.decimals))
  // A USDC-in fee comes off the input before routing; a USDC-out fee comes off the output.
  const routed = from.symbol === 'USDC' && feeBps ? (raw * BigInt(10_000 - feeBps)) / 10_000n : raw
  const url = `${QUOTE}?inputMint=${from.mint}&outputMint=${to.mint}&amount=${routed}&slippageBps=50`
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: process.env.JUPITER_API_KEY ? { 'x-api-key': process.env.JUPITER_API_KEY } : {} })
    const j = (await r.json()) as { outAmount?: string; priceImpactPct?: string; routePlan?: { swapInfo?: { label?: string } }[]; error?: string }
    if (!r.ok || !j.outAmount) return NextResponse.json({ error: j.error || 'No route for this pair right now' }, { status: 502 })
    const gross = Number(j.outAmount) / 10 ** to.decimals
    const out = to.symbol === 'USDC' && feeBps ? gross * (1 - feeBps / 10_000) : gross
    const feeUsd = !feeBps ? 0 : from.symbol === 'USDC' ? (amount * feeBps) / 10_000 : (gross * feeBps) / 10_000
    return NextResponse.json({
      out,
      feeBps,
      feeUsd,
      priceImpactPct: Number(j.priceImpactPct ?? 0) * 100,
      route: [...new Set((j.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean))],
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
