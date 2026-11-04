/**
 * Builds a swap for the Trade tab: POST { from, inputMint, outputMint, amount, slippageBps? }
 * (amount in the input token's smallest unit) -> a transaction for the trader to sign.
 *
 * Wallets with almost no SOL get the network fee paid by Umanity (the
 * treasury signs first as fee payer), at most a few times a day each.
 */
import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getConnection } from '@/lib/solana/chain'
import { getTreasuryKeypair } from '@/lib/solana/server-signer'
import { IS_MAINNET } from '@/lib/solana/constants'
import { buildSwap } from '@/lib/umanity/swap'

export const dynamic = 'force-dynamic'

const NEEDS_HELP_LAMPORTS = 3_000_000
const SPONSORED_PER_DAY = 3
const sponsoredToday = new Map<string, { day: string; n: number }>()

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  if (!IS_MAINNET) return bad('Swaps run on Solana mainnet', 409)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  let taker: PublicKey
  try {
    taker = new PublicKey(String(body.from))
  } catch {
    return bad('Sign in first')
  }
  const inputMint = String(body.inputMint ?? '')
  const outputMint = String(body.outputMint ?? '')
  const amount = String(body.amount ?? '')
  if (!/^[1-9][0-9]{0,19}$/.test(amount) || inputMint === outputMint) return bad('Pick two different tokens and an amount')
  const slippageBps = Math.min(Math.max(Number(body.slippageBps) || 50, 10), 500)

  const conn = getConnection()
  const day = new Date().toISOString().slice(0, 10)
  const used = sponsoredToday.get(taker.toBase58())
  const count = used?.day === day ? used.n : 0
  const low = (await conn.getBalance(taker, 'confirmed').catch(() => 0)) < NEEDS_HELP_LAMPORTS
  const sponsor = low && count < SPONSORED_PER_DAY ? getTreasuryKeypair() : null
  if (low && !sponsor) return bad('You need a little SOL (about $0.30) for network fees')

  try {
    const built = await buildSwap(conn, { inputMint, outputMint, amount, taker, slippageBps, sponsor })
    if (sponsor) sponsoredToday.set(taker.toBase58(), { day, n: count + 1 })
    return NextResponse.json(built)
  } catch (e) {
    return bad((e as Error).message, 502)
  }
}
