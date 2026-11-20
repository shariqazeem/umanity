/**
 * Gifts into the drops fund from a person's own wallet, with Umanity paying the
 * network fee. The fund backs every drop: the program only moves its money into
 * drop pots, and a pot that misses its date sends it back to the fund.
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
import { eq } from 'drizzle-orm'
import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js'
import { fundGifts, getDb } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { getTreasuryKeypair } from '@/lib/solana/server-signer'
import { PRIORITY_MICROLAMPORTS, sendAndLand } from '@/lib/solana/send'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'
import { fundGiftIxs, tokenBalance, usdcAccount } from '@/lib/umanity/program'

export const dynamic = 'force-dynamic'

/** Sponsored gifts start at $1, so nobody can drain the fee budget with dust. */
const MIN_SPONSORED_MICRO = 1_000_000n
/** A sanity cap on one sponsored gift ($25,000); bigger gifts can be split. */
const MAX_SPONSORED_MICRO = 25_000_000_000n

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
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
    if (amount > MAX_SPONSORED_MICRO) return bad('The biggest single gift is $25,000')
    const balance = await tokenBalance(conn, usdcAccount(from))
    if (balance < amount) return NextResponse.json({ error: 'Not enough USDC', balanceMicro: balance.toString() }, { status: 402 })

    const ref = randomBytes(16)
    const latest = await conn.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight })
    if (IS_MAINNET) {
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }))
    }
    tx.add(...fundGiftIxs({ giver: from, amount, ref }))
    tx.partialSign(sponsor)

    const db = await getDb()
    await db.insert(fundGifts).values({
      ref: ref.toString('hex'),
      cluster: SOLANA_CLUSTER,
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
    const gift = (await db.select().from(fundGifts).where(eq(fundGifts.ref, ref)))[0]
    if (!gift || gift.cluster !== SOLANA_CLUSTER) return bad('Unknown gift', 404)
    if (gift.status === 'confirmed') return NextResponse.json({ signature: gift.signature })
    if (!tx.feePayer?.equals(sponsor.publicKey) || !tx.verifySignatures()) return bad('This transaction is not signed as prepared')
    // The memo names the gift, so a transaction prepared for another gift can't confirm this one.
    const memo = `umanity:fund:${ref}`
    if (!tx.instructions.some((ix) => ix.data.toString() === memo)) return bad('This transaction is for another gift')

    try {
      const { signature, confirmed } = await sendAndLand(conn, tx.serialize(), { timeoutMs: 40_000 })
      if (!confirmed) {
        // Keep the signature, so the money summary can confirm it once it lands.
        await db.update(fundGifts).set({ signature }).where(eq(fundGifts.ref, ref))
        return NextResponse.json({ signature, pending: true })
      }
      await db.update(fundGifts).set({ status: 'confirmed', signature }).where(eq(fundGifts.ref, ref))
      return NextResponse.json({ signature })
    } catch (e) {
      await db.update(fundGifts).set({ status: 'failed' }).where(eq(fundGifts.ref, ref))
      return bad((e as Error).message.slice(0, 300), 502)
    }
  }

  return bad('Unknown action')
}
