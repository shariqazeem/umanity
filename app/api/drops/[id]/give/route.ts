/**
 * Gifts from a person's own wallet, with Umanity paying the network fee and
 * the backer record's rent (returned to Umanity after the drop unlocks).
 *
 *   POST { action: 'prepare', from, amountMicro, anonymous?, message? }
 *     -> { ref, tx }  a transaction the sponsor has already signed
 *   POST { action: 'submit', ref, tx }  (tx now signed by the giver too)
 *     -> { signature }
 *
 * The sponsor signs the exact message first, so a giver can't change it and
 * still have Umanity pay for it.
 */
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js'
import { dropGifts, getDb } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { getTreasuryKeypair } from '@/lib/solana/server-signer'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'
import { fetchDrop, giveIx, potAddress, tokenBalance, usdcAccount, usd } from '@/lib/umanity/program'

export const dynamic = 'force-dynamic'

/** Sponsored gifts start at $1, so nobody can drain the fee budget with dust. */
const MIN_SPONSORED_MICRO = 1_000_000n

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const dropId = Number((await params).id)
  if (!Number.isInteger(dropId) || dropId < 0) return bad('Unknown drop', 404)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const sponsor = getTreasuryKeypair()
  if (!sponsor) return bad('Giving is not set up on this server', 503)
  const conn = getConnection()

  if (body.action === 'prepare') {
    let from: PublicKey
    let amount: bigint
    try {
      from = new PublicKey(String(body.from))
      amount = BigInt(String(body.amountMicro))
    } catch {
      return bad('Send from and amountMicro')
    }
    if (amount < MIN_SPONSORED_MICRO) return bad('The smallest gift is $1')

    const drop = await fetchDrop(conn, dropId)
    if (!drop) return bad('Unknown drop', 404)
    if (drop.state !== 'open' || Date.now() / 1000 >= drop.deadline) return bad('This drop is no longer taking gifts')
    const pot = await tokenBalance(conn, potAddress(dropId))
    if (pot + amount > drop.cap) return bad(`This pot has room for $${usd(drop.cap - pot).toFixed(2)} more`)
    const balance = await tokenBalance(conn, usdcAccount(from))
    if (balance < amount) return NextResponse.json({ error: 'Not enough USDC', balanceMicro: balance.toString() }, { status: 402 })

    const ref = randomBytes(16)
    const latest = await conn.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight })
    if (IS_MAINNET) {
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }))
    }
    tx.add(await giveIx(conn, { dropId, giver: from, amount, ref, payer: sponsor.publicKey }))
    tx.partialSign(sponsor)

    const db = await getDb()
    await db.insert(dropGifts).values({
      ref: ref.toString('hex'),
      cluster: SOLANA_CLUSTER,
      dropId,
      backer: from.toBase58(),
      giver: from.toBase58(),
      userId: from.toBase58(),
      amountMicro: Number(amount),
      channel: 'wallet',
      status: 'pending',
      anonymous: body.anonymous === true,
      message: typeof body.message === 'string' ? body.message.slice(0, 140) : null,
    })
    return NextResponse.json({ ref: ref.toString('hex'), tx: tx.serialize({ requireAllSignatures: false }).toString('base64') })
  }

  if (body.action === 'submit') {
    const ref = String(body.ref ?? '')
    let tx: Transaction
    try {
      tx = Transaction.from(Buffer.from(String(body.tx), 'base64'))
    } catch {
      return bad('Send the signed transaction')
    }
    const db = await getDb()
    const gift = (await db.select().from(dropGifts).where(and(eq(dropGifts.ref, ref), eq(dropGifts.dropId, dropId))))[0]
    if (!gift) return bad('Unknown gift', 404)
    if (gift.status === 'confirmed') return NextResponse.json({ signature: gift.signature })
    if (!tx.feePayer?.equals(sponsor.publicKey) || !tx.verifySignatures()) return bad('This transaction is not signed as prepared')

    try {
      const signature = await conn.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed' })
      for (let i = 0; i < 40; i++) {
        const s = (await conn.getSignatureStatuses([signature])).value[0]
        if (s?.err) throw new Error(`The gift failed on-chain: ${JSON.stringify(s.err)}`)
        if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') {
          await db.update(dropGifts).set({ status: 'confirmed', signature }).where(eq(dropGifts.ref, ref))
          return NextResponse.json({ signature })
        }
        await new Promise((r) => setTimeout(r, 750))
      }
      return NextResponse.json({ signature, pending: true })
    } catch (e) {
      await db.update(dropGifts).set({ status: 'failed' }).where(eq(dropGifts.ref, ref))
      return bad((e as Error).message.slice(0, 300), 502)
    }
  }

  return bad('Unknown action')
}
