import { NextRequest, NextResponse } from 'next/server'
import { withX402, giveAmount, GIVE_MIN_USD, GIVE_MAX_USD, PAID_ROUTES, X402_NETWORK, X402_PAY_TO, X402_FACILITATOR_URL } from '@/lib/x402/server'
import { getCause, CAUSES } from '@/lib/causes'
import { ensureUser } from '@/lib/data/users'
import { recordDonation } from '@/lib/data/donations'
import { creditGiftToCampaign } from '@/lib/data/governance'
import { getSolUsd } from '@/lib/server/price'
import { depositToEscrow } from '@/lib/solana/escrow-forward'
import { derivePoolAddresses } from '@/lib/solana/pda'
import { explorerTx, explorerAccount, LAMPORTS_PER_SOL, USDC_MINT } from '@/lib/solana/constants'
import { isPubkey } from '@/lib/api'
import { signReceipt } from '@/lib/server/sign-receipt'
import { getAuthorityKeypair } from '@/lib/solana/server-signer'

export const runtime = 'nodejs'

interface GiveBody {
  causeId?: string
  amountUsd?: number | string
  /** A name the agent gives itself; shown on the gift. */
  agent?: string
  anonymous?: boolean
}

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.xyz'

/**
 * POST /api/x402/give { causeId, amountUsd, agent? } — PAID (x402, USDC on Solana)
 *
 * The payment is the gift. Without PAYMENT-SIGNATURE the server answers 402
 * with the exact amount the agent asked to give. Once the facilitator verifies
 * and settles the USDC transfer on Solana, the treasury deposits the SOL
 * equivalent into the cause's escrow vault (donate + memo naming the x402
 * settlement), the gift is recorded, and a receipt comes back. A gift that
 * cannot be validated is refused before settlement, so the agent is never charged.
 */
export const POST = withX402<GiveBody>(
  'give',
  async () => NextResponse.json({ success: true }),
  {
    validate: (body) => {
      if (!body.causeId || !getCause(body.causeId)) return `Unknown causeId. Use one of: ${CAUSES.map((c) => c.id).join(', ')}`
      if (!giveAmount(body.amountUsd)) return `amountUsd must be between ${GIVE_MIN_USD} and ${GIVE_MAX_USD}`
      return null
    },
    amountFor: (body) => giveAmount(body.amountUsd) ?? '0',
    afterSettle: async (body, paid, settlement) => {
      const cause = getCause(body.causeId!)!
      const usd = Number(giveAmount(body.amountUsd))
      const agent = typeof body.agent === 'string' ? body.agent.replace(/[^\w .\-@]/g, '').slice(0, 40) : undefined
      const payer = isPubkey(settlement.payer) ? settlement.payer! : isPubkey(paid.payer) ? paid.payer! : null

      const { usd: solUsd } = await getSolUsd()
      const lamports = solUsd ? Math.floor((usd / solUsd) * LAMPORTS_PER_SOL) : 0

      // Into escrow: the treasury forwards the SOL equivalent into the cause vault, memo links the x402 tx.
      let escrow: Awaited<ReturnType<typeof depositToEscrow>> | null = null
      let escrowError: string | null = null
      if (lamports > 0) {
        try {
          escrow = await depositToEscrow(cause.id, lamports, `umanity:x402:${settlement.transaction ?? paid.receiptId}:${payer ?? 'agent'}`)
        } catch (e) {
          escrowError = e instanceof Error ? e.message : 'forward failed'
        }
      }

      let gift: { id: string; points: number; tier: string } | null = null
      if (payer) {
        await ensureUser(payer)
        const r = await recordDonation({
          donorAddress: payer,
          poolId: cause.id,
          amountLamports: lamports,
          signature: escrow?.signature ?? settlement.transaction ?? `x402_${paid.receiptId}`,
          route: 'x402',
          settlementSignature: settlement.transaction,
          sourceAsset: 'USDC',
          sourceAmount: usd.toFixed(2),
          agent,
          anonymous: !!body.anonymous,
        })
        gift = { id: r.donation.id, points: r.points, tier: r.tier }
        // Only value that reached the vault counts toward the campaign's milestones.
        if (r.created && escrow) await creditGiftToCampaign(cause.id, lamports, payer).catch((e) => console.error('campaign credit', e))
      }

      const vault = derivePoolAddresses(cause.id).vaultPda
      return {
        receipt: signReceipt({
          issuedAt: new Date().toISOString(),
          gift: { id: gift?.id ?? null, cause: { id: cause.id, name: cause.name }, amountUsd: usd.toFixed(2), asset: 'USDC', solEquivalent: lamports / LAMPORTS_PER_SOL, solUsd, agent: agent ?? null, points: gift?.points ?? 0, certificate: gift?.tier ?? null },
          settlement: { transaction: settlement.transaction ?? null, network: settlement.network ?? X402_NETWORK, payer, explorer: settlement.transaction ? explorerTx(settlement.transaction) : null },
          escrow: escrow
            ? { status: 'deposited', vault: escrow.vault, deposit: escrow.signature, explorer: explorerTx(escrow.signature), vaultExplorer: explorerAccount(escrow.vault) }
            : { status: 'held_by_treasury', vault, reason: escrowError ?? 'price unavailable', note: 'The USDC settled to the Umanity treasury; the escrow deposit did not go through on this request and is made by the field team from the treasury, visible on the ledger.' },
          receiptId: paid.receiptId,
          track: gift?.id ? `${APP}/gift/${gift.id}` : null,
          cause: `${APP}/causes/${cause.id}`,
        }),
      }
    },
  }
)

/** GET — discovery (free): what this endpoint sells and how to pay. */
export async function GET(_req: NextRequest) {
  const r = PAID_ROUTES.give
  return NextResponse.json({
    resource: r.path,
    description: r.description,
    method: 'POST',
    body: { causeId: CAUSES.map((c) => c.id).join(' | '), amountUsd: `number, ${GIVE_MIN_USD}–${GIVE_MAX_USD}`, agent: 'string? (shown on the gift)', anonymous: 'boolean?' },
    price: 'the amountUsd you send, in USDC',
    network: X402_NETWORK,
    asset: USDC_MINT,
    payTo: X402_PAY_TO,
    facilitator: X402_FACILITATOR_URL,
    protocol: 'x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE)',
    receipts: { alg: 'ed25519', signer: getAuthorityKeypair()?.publicKey.toBase58() ?? null, verify: 'nacl.sign.detached.verify(canonical-json(receipt without proof), base58(signature), base58(signer)); see lib/receipt.ts' },
    causes: CAUSES.map((c) => ({ id: c.id, name: c.name, impact: c.impact })),
  })
}
