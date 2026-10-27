import { NextRequest, NextResponse } from 'next/server'
import { withX402, PAID_ROUTES, X402_NETWORK, X402_PAY_TO, X402_FACILITATOR_URL } from '@/lib/x402/server'
import { getMilestone, setMilestoneAttestation } from '@/lib/data/governance'
import { runImpactOracle } from '@/lib/oracle/impact-oracle'
import { attestMilestoneOnChain } from '@/lib/solana/authority-ops'
import { getCause } from '@/lib/causes'
import { explorerTx, USDC_MINT } from '@/lib/solana/constants'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/x402/verify-milestone { milestoneId }  — PAID (x402, USDC on Solana)
 *
 * 1. No PAYMENT-SIGNATURE → 402 with PAYMENT-REQUIRED (how to pay).
 * 2. Payment verified → the AI Impact Oracle audits the milestone evidence.
 * 3. The attestation is stored, its hash is written on-chain (attest_milestone),
 *    and the payment is settled; PAYMENT-RESPONSE carries the settlement tx.
 */
export const POST = withX402<{ milestoneId?: string }>('verifyMilestone', async (body, paid) => {
  if (!body.milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })
  const m = await getMilestone(body.milestoneId)
  if (!m) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  const cause = getCause(m.campaign.poolId)
  const attestation = await runImpactOracle({
    milestoneId: m.id,
    causeName: cause?.name ?? m.campaign.poolId,
    milestoneDescription: m.description,
    amountSol: m.amount,
    recipient: m.campaign.recipient,
    deliveryMode: cause?.deliveryMode ?? 'trust',
    evidence: m.evidence,
  })
  attestation.paymentSignature = paid.receiptId
  await setMilestoneAttestation(m.id, attestation)
  const onchain = await attestMilestoneOnChain(m.id, attestation)
  const responseHash = createHash('sha256').update(JSON.stringify(attestation)).digest('hex')
  return NextResponse.json({
    success: true,
    milestoneId: m.id,
    attestation,
    onchain: onchain ? { signature: onchain, explorer: explorerTx(onchain) } : null,
    responseHash,
    paidBy: paid.payer ?? null,
    receiptId: paid.receiptId,
  })
})

/** GET — discovery: describes the paid resource (free). */
export async function GET(_req: NextRequest) {
  const r = PAID_ROUTES.verifyMilestone
  return NextResponse.json({
    resource: r.path,
    description: r.description,
    method: 'POST',
    body: { milestoneId: 'string' },
    price: `$${r.price} USDC`,
    network: X402_NETWORK,
    asset: USDC_MINT,
    payTo: X402_PAY_TO,
    facilitator: X402_FACILITATOR_URL,
    protocol: 'x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers)',
    agentExample: 'see scripts/x402-agent.ts',
  })
}
