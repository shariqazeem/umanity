import { ok } from '@/lib/api'
import { getX402Receipts } from '@/lib/data/intents'
import { PAID_ROUTES, X402_NETWORK, X402_PAY_TO, X402_FACILITATOR_URL } from '@/lib/x402/server'
import { USDC_MINT } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/** GET /api/x402/receipts — recent paid calls + the paid-resource catalogue. */
export async function GET() {
  const receipts = await getX402Receipts(20)
  return ok({ receipts, catalogue: Object.values(PAID_ROUTES), network: X402_NETWORK, asset: USDC_MINT, payTo: X402_PAY_TO, facilitator: X402_FACILITATOR_URL })
}
