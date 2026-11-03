import { NextRequest, NextResponse } from 'next/server'
import { withX402, PAID_ROUTES, X402_NETWORK, X402_PAY_TO } from '@/lib/x402/server'
import { getCause } from '@/lib/causes'
import { ensureUser } from '@/lib/data/users'
import { createDare } from '@/lib/data/dares'
import { isPubkey } from '@/lib/api'

export const runtime = 'nodejs'

interface SponsorBody {
  targetHandle?: string
  poolId?: string
  text?: string
  hours?: number
}

/**
 * POST /api/x402/sponsor-dare { targetHandle, poolId, text, hours? } — PAID (x402)
 *
 * Lets an AI agent or a brand open an Impact Dare without holding SOL: the
 * USDC micropayment covers the listing. The dare is created only after the
 * payment settles, and it is credited to the wallet that actually signed the
 * payment (never to an address supplied in the body).
 */
export const POST = withX402<SponsorBody>(
  'sponsorDare',
  async () => NextResponse.json({ success: true }),
  {
    validate: (b) => (!b.targetHandle || !/^[a-z0-9_]{1,32}$/i.test(b.targetHandle) ? 'targetHandle required (letters, numbers, _)' : !b.poolId || !getCause(b.poolId) ? 'poolId must be an existing cause' : !b.text?.trim() ? 'text required' : null),
    afterSettle: async (body, _paid, settlement) => {
      if (!isPubkey(settlement.payer)) return { recorded: false, warning: 'Payment settled but the payer could not be read; the dare will be created on reconciliation.' }
      await ensureUser(settlement.payer!)
      const dare = await createDare({ creatorAddress: settlement.payer!, targetHandle: body.targetHandle!.toLowerCase(), poolId: body.poolId!, text: `${body.text!.trim().slice(0, 160)} (sponsored via x402)`, stakeLamports: 0, hours: Math.min(168, Math.max(1, body.hours ?? 48)) })
      return { dare, sponsor: settlement.payer, blink: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/actions/dare/${dare.id}` }
    },
  }
)

export async function GET(_req: NextRequest) {
  const r = PAID_ROUTES.sponsorDare
  return NextResponse.json({ resource: r.path, description: r.description, method: 'POST', body: { targetHandle: 'string', poolId: 'string', text: 'string', hours: 'number?' }, price: `$${r.price} USDC`, network: X402_NETWORK, payTo: X402_PAY_TO })
}
