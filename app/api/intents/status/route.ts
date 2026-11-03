import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { refreshIntent, intentExplorer } from '@/lib/intents/settle'

export const runtime = 'nodejs'

/** GET /api/intents/status?id= — polls NEAR Intents; on SUCCESS forwards into escrow and credits the cause (once). */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return fail('id required')
  const r = await refreshIntent(id)
  if (!r) return fail('Intent not found', 404)
  const raw = r.raw
  const escrow = (r.intent.lastStatusPayload as { umanity?: { escrowSignature?: string | null; mode?: string } } | null)?.umanity ?? r.credited ?? null
  return ok({
    intent: r.intent,
    escrow,
    shortfall: raw?.status === 'INCOMPLETE_DEPOSIT' ? { received: raw.swapDetails?.amountInFormatted ?? null, expected: raw.quoteResponse?.quote?.amountInFormatted ?? null, deadline: raw.quoteResponse?.quote?.deadline ?? null } : null,
    refund: raw?.status === 'REFUNDED' ? { amount: raw.swapDetails?.refundedAmountFormatted ?? null, reason: raw.swapDetails?.refundReason ?? null } : null,
    explorer: intentExplorer(r.intent.depositAddress),
    error: r.error,
  })
}
