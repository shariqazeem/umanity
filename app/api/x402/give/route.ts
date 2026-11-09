import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { PublicKey } from '@solana/web3.js'
import { signAndLand } from '@/lib/solana/send'
import { withX402, giveAmount, GIVE_MAX_USD, PAID_ROUTES, X402_NETWORK, X402_PAY_TO, X402_FACILITATOR_URL } from '@/lib/x402/server'
import { ensureUser } from '@/lib/data/users'
import { dropGifts, getDb } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { getAuthorityKeypair, getTreasuryKeypair } from '@/lib/solana/server-signer'
import { explorerTx, explorerAccount, IS_MAINNET, SOLANA_CLUSTER, USDC_MINT } from '@/lib/solana/constants'
import { isPubkey } from '@/lib/api'
import { signReceipt } from '@/lib/server/sign-receipt'
import { fetchDrop, giveIx, potAddress, refundsOpen, tokenBalance, usd as usdOf } from '@/lib/umanity/program'
import { listDrops, nextDrop } from '@/lib/umanity/data'

export const runtime = 'nodejs'

interface GiveBody {
  /** Drop number as shown in the app (#1 is the first). Defaults to the next drop. */
  drop?: number | string
  amountUsd?: number | string
  /** A name the agent gives itself; shown on the gift. */
  agent?: string
  anonymous?: boolean
}

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.vercel.app'
/** Each gift opens a backer record, so drop gifts start at a dollar. */
const MIN_USD = 1

/** The drop a request names (1-based, as the app shows it), or the next one. Checked against the chain. */
async function pickDrop(body: GiveBody) {
  const n = body.drop == null || body.drop === '' ? null : Number(body.drop)
  const id = n == null ? (await nextDrop())?.id : Number.isInteger(n) && n >= 1 ? n - 1 : -1
  if (id == null || id < 0) return null
  const chain = await fetchDrop(getConnection(), id)
  return chain ? { id, chain } : null
}

/**
 * POST /api/x402/give { drop?, amountUsd, agent? }: PAID (x402, USDC on Solana)
 *
 * The payment is the gift. Without PAYMENT-SIGNATURE the server answers 402
 * with the exact amount the agent asked to give. Once the facilitator settles
 * the USDC to the Umanity treasury, the treasury puts the same USDC into the
 * drop's pot with the agent's paying wallet as the backer, so if the drop
 * misses its date the refund goes back to that wallet. A gift the drop can't
 * take (closed, past its date, pot full) is refused before settlement, so the
 * agent is never charged for it.
 */
export const POST = withX402<GiveBody>(
  'give',
  async () => NextResponse.json({ success: true }),
  {
    validate: async (body) => {
      // The key that gives into the pot must be the one the agent pays, or the agent would pay twice.
      if (getTreasuryKeypair()?.publicKey.toBase58() !== X402_PAY_TO) return 'Agent gifts are not set up on this server'
      const amount = giveAmount(body.amountUsd)
      if (!amount || Number(amount) < MIN_USD) return `amountUsd must be between ${MIN_USD} and ${GIVE_MAX_USD}`
      const picked = await pickDrop(body)
      if (!picked) return 'No drop is filling right now (or that drop does not exist). GET this endpoint for the list.'
      const { chain } = picked
      const now = Math.floor(Date.now() / 1000)
      if (chain.state !== 'open' || refundsOpen({ state: chain.state, deadline: chain.deadline }) || now > chain.deadline) return `Drop #${picked.id + 1} is not taking gifts any more`
      const pot = await tokenBalance(getConnection(), potAddress(picked.id))
      if (BigInt(Math.round(Number(amount) * 1e6)) + pot > chain.cap) return `Drop #${picked.id + 1} has room for $${usdOf(chain.cap - pot).toFixed(2)} more`
      return null
    },
    amountFor: (body) => giveAmount(body.amountUsd) ?? '0',
    afterSettle: async (body, paid, settlement) => {
      const amount = Number(giveAmount(body.amountUsd))
      const micro = BigInt(Math.round(amount * 1e6))
      const agent = typeof body.agent === 'string' ? body.agent.replace(/[^\w .\-@]/g, '').slice(0, 40) : undefined
      const payer = isPubkey(settlement.payer) ? settlement.payer! : isPubkey(paid.payer) ? paid.payer! : null
      const picked = await pickDrop(body)
      const treasury = getTreasuryKeypair()

      // Into the pot: the treasury gives the USDC it just received, with the agent's wallet as backer.
      let give: { signature: string } | null = null
      let giveError: string | null = null
      const ref = randomBytes(16)
      if (picked && treasury && payer) {
        try {
          const conn = getConnection()
          const giveInstruction = await giveIx(conn, { dropId: picked.id, giver: treasury.publicKey, amount: micro, ref, backer: new PublicKey(payer), payer: treasury.publicKey })
          const db = await getDb()
          await ensureUser(payer)
          await db.insert(dropGifts).values({
            ref: ref.toString('hex'),
            cluster: SOLANA_CLUSTER,
            dropId: picked.id,
            backer: payer,
            giver: treasury.publicKey.toBase58(),
            userId: payer,
            amountMicro: Number(micro),
            channel: 'x402',
            sourceAsset: 'USDC',
            sourceAmount: amount.toFixed(2),
            anonymous: !!body.anonymous,
            message: agent ? `Sent by agent "${agent}" over x402` : null,
          })
          give = { signature: await signAndLand(conn, [giveInstruction], [treasury], { units: 60_000, timeoutMs: 40_000 }) }
        } catch (e) {
          giveError = e instanceof Error ? e.message : 'give failed'
        }
      }

      const drop = picked ? (await listDrops()).find((d) => d.id === picked.id) : null
      return {
        receipt: signReceipt({
          issuedAt: new Date().toISOString(),
          gift: { ref: ref.toString('hex'), drop: picked ? { number: picked.id + 1, title: drop?.title ?? null, address: picked.chain.address } : null, amountUsd: amount.toFixed(2), asset: 'USDC', agent: agent ?? null, backer: payer },
          settlement: { transaction: settlement.transaction ?? null, network: settlement.network ?? X402_NETWORK, payer, explorer: settlement.transaction ? explorerTx(settlement.transaction) : null },
          pot: give
            ? { status: 'in_pot', give: give.signature, explorer: explorerTx(give.signature), pot: picked ? explorerAccount(potAddress(picked.id).toBase58()) : null }
            : { status: 'held_by_treasury', reason: giveError ?? 'drop or payer unavailable', note: 'The USDC settled to the Umanity treasury but did not reach the pot on this request. It is visible on the Money page and is put in by hand or refunded.' },
          rules: 'The pot pays out only after the delivery is filmed and checked. If the drop misses its date, the backer (your paying wallet) can take this gift back.',
          receiptId: paid.receiptId,
          drop: picked ? `${APP}/drops/${picked.id + 1}` : null,
        }),
      }
    },
  }
)

/** GET: discovery (free). What this endpoint sells, how to pay, and which drops are filling. */
export async function GET(_req: NextRequest) {
  const r = PAID_ROUTES.give
  const drops = (await listDrops().catch(() => [])).filter((d) => d.state === 'open' && !d.refundsOpen)
  return NextResponse.json({
    resource: r.path,
    description: r.description,
    method: 'POST',
    body: { drop: 'number? (as shown in the app, e.g. 1; defaults to the next drop)', amountUsd: `number, ${MIN_USD}–${GIVE_MAX_USD}`, agent: 'string? (shown on the gift)', anonymous: 'boolean?' },
    price: 'the amountUsd you send, in USDC',
    network: X402_NETWORK,
    asset: USDC_MINT,
    payTo: X402_PAY_TO,
    facilitator: X402_FACILITATOR_URL,
    protocol: 'x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE)',
    receipts: { alg: 'ed25519', signer: getAuthorityKeypair()?.publicKey.toBase58() ?? null, verify: 'nacl.sign.detached.verify(canonical-json(receipt without proof), base58(signature), base58(signer)); see lib/receipt.ts' },
    drops: drops.map((d) => ({ drop: d.id + 1, title: d.title, place: d.place, unit: `${d.unit.name} = $${d.unit.usd}`, potUsd: d.potUsd, goalUsd: d.goalUsd, roomUsd: Math.max(0, d.capUsd - d.potUsd), deadline: new Date(d.deadline * 1000).toISOString(), page: `${APP}/drops/${d.id + 1}` })),
  })
}
