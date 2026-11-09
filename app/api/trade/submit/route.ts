/**
 * Sends a signed swap from the Trade tab and records it:
 * POST { tx, inputMint, outputMint, inAmount, outAmount, usdMicro, feeBps, feeMicro } -> { signature }
 * The amounts are the quote's; the fee itself is visible on-chain in the fee inbox.
 */
import { NextResponse } from 'next/server'
import { VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { eq } from 'drizzle-orm'
import { getDb, trades } from '@/lib/db'
import { getConnection } from '@/lib/solana/chain'
import { sendAndLand } from '@/lib/solana/send'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'

export const dynamic = 'force-dynamic'

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  if (!IS_MAINNET) return bad('Swaps run on Solana mainnet', 409)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  let tx: VersionedTransaction
  try {
    tx = VersionedTransaction.deserialize(Buffer.from(String(body.tx), 'base64'))
  } catch {
    return bad('That transaction could not be read')
  }
  if (tx.signatures.some((s) => s.every((b) => b === 0))) return bad('The transaction is missing a signature')
  const keys = tx.message.staticAccountKeys
  const taker = keys[tx.message.header.numRequiredSignatures > 1 ? 1 : 0]?.toBase58() ?? ''
  const signature = bs58.encode(tx.signatures[0])

  const db = await getDb()
  const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)))
  await db
    .insert(trades)
    .values({
      signature,
      cluster: SOLANA_CLUSTER,
      address: taker,
      inputMint: String(body.inputMint ?? ''),
      outputMint: String(body.outputMint ?? ''),
      inAmount: String(body.inAmount ?? '0'),
      outAmount: String(body.outAmount ?? '0'),
      usdMicro: num(body.usdMicro),
      feeBps: num(body.feeBps) ?? 0,
      feeMicro: num(body.feeMicro) ?? 0,
      sponsored: tx.message.header.numRequiredSignatures > 1,
    })
    .onConflictDoNothing()

  const conn = getConnection()
  let landed: Awaited<ReturnType<typeof sendAndLand>>
  try {
    landed = await sendAndLand(conn, tx.serialize(), { timeoutMs: 40_000 })
  } catch (e) {
    await db.update(trades).set({ status: 'failed' }).where(eq(trades.signature, signature))
    const logs = (e as { logs?: string[] }).logs?.join('\n') ?? ''
    return bad(/slippage|0x1771/i.test(logs) ? 'The price moved. Try again' : 'The swap did not go through', 502)
  }
  if (!landed.confirmed) return NextResponse.json({ signature, pending: true })
  await db.update(trades).set({ status: 'confirmed' }).where(eq(trades.signature, signature))
  return NextResponse.json({ signature })
}
