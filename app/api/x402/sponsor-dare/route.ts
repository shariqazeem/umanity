import { NextRequest, NextResponse } from 'next/server'
import { withX402, PAID_ROUTES, X402_NETWORK, X402_PAY_TO } from '@/lib/x402/server'
import { getCause } from '@/lib/causes'
import { ensureUser } from '@/lib/data/users'
import { createDare } from '@/lib/data/dares'
import { getAuthorityKeypair } from '@/lib/solana/server-signer'
import { isPubkey } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * POST /api/x402/sponsor-dare { targetHandle, poolId, text, hours?, sponsor? } — PAID (x402)
 *
 * Lets an AI agent or a brand sponsor open an Impact Dare without holding SOL:
 * the USDC micropayment covers the listing; the dare is created by the Umanity
 * sponsor account and shows "Sponsored by <payer>". Backers boost it on-chain.
 */
export const POST = withX402<{ targetHandle?: string; poolId?: string; text?: string; hours?: number; sponsor?: string }>('sponsorDare', async (body, paid) => {
  if (!body.targetHandle || !body.poolId || !getCause(body.poolId) || !body.text) return NextResponse.json({ error: 'targetHandle, poolId and text required' }, { status: 400 })
  const authority = getAuthorityKeypair()
  const sponsorAddress = isPubkey(body.sponsor) ? body.sponsor! : isPubkey(paid.payer) ? paid.payer! : authority?.publicKey.toBase58()
  if (!sponsorAddress) return NextResponse.json({ error: 'No sponsor account available' }, { status: 503 })
  await ensureUser(sponsorAddress)
  const dare = await createDare({ creatorAddress: sponsorAddress, targetHandle: body.targetHandle, poolId: body.poolId, text: `${body.text.slice(0, 160)} (sponsored via x402)`, stakeLamports: 0, hours: Math.min(168, Math.max(1, body.hours ?? 48)) })
  return NextResponse.json({ success: true, dare, sponsor: sponsorAddress, receiptId: paid.receiptId, blink: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/actions/dare/${dare.id}` })
})

export async function GET(_req: NextRequest) {
  const r = PAID_ROUTES.sponsorDare
  return NextResponse.json({ resource: r.path, description: r.description, method: 'POST', body: { targetHandle: 'string', poolId: 'string', text: 'string', hours: 'number?' }, price: `$${r.price} USDC`, network: X402_NETWORK, payTo: X402_PAY_TO })
}
