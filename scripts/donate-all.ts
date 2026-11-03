/**
 * Exercises `donate_all(nonce, keep)`, the instruction Aurora Intents Connect
 * calls after a cross-chain swap lands: a fresh account gives its entire
 * balance (minus `keep`) to a cause's escrow in one instruction, so the amount
 * never has to be known in advance.
 *
 *   npx tsx scripts/donate-all.ts [causeId] [fundSol] [baseUrl]
 *   npx tsx scripts/donate-all.ts clean-water 0.02
 *
 * Funds a throwaway account from ~/.config/solana/devnet.json (or
 * FUNDER_KEYPAIR_PATH), calls donate_all with keep = 0, then hands the
 * signature to /api/donate/sync so the gift is booked from the chain like any
 * other. Devnet only.
 */
import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getConnection } from '@/lib/solana/chain'
import { buildDonateAllIx } from '@/lib/solana/instructions'

async function main() {
  const [causeId = 'clean-water', fundSol = '0.02', base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'] = process.argv.slice(2)
  const conn = getConnection()
  if (!conn.rpcEndpoint.includes('devnet')) throw new Error(`refusing to run against ${conn.rpcEndpoint}: devnet only`)

  const funderPath = process.env.FUNDER_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/devnet.json')
  const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(funderPath, 'utf8'))))
  const donor = Keypair.generate()
  const lamports = Math.round(Number(fundSol) * LAMPORTS_PER_SOL)
  console.log(`donor         ${donor.publicKey.toBase58()} (fresh)`)

  const fund = await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: donor.publicKey, lamports })), [funder], { commitment: 'confirmed' })
  console.log(`funded        ${fundSol} SOL · ${fund}`)

  const { ix, vaultPda, recordPda } = await buildDonateAllIx(conn, causeId, donor.publicKey, 0)
  const before = await conn.getBalance(vaultPda, 'confirmed')
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [donor], { commitment: 'confirmed' })
  const after = await conn.getBalance(vaultPda, 'confirmed')
  const left = await conn.getBalance(donor.publicKey, 'confirmed')
  console.log(`donate_all    ${sig}`)
  console.log(`vault         ${vaultPda.toBase58()} +${(after - before) / LAMPORTS_PER_SOL} SOL`)
  console.log(`record        ${recordPda.toBase58()}`)
  console.log(`donor left    ${left} lamports`)

  const res = await fetch(`${base}/api/donate/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor: donor.publicKey.toBase58(), pool: causeId, signature: sig }),
  })
  const json = await res.json().catch(() => ({}))
  console.log(`booked        HTTP ${res.status} ${json?.donation ? `gift ${json.donation.id} · ${json.donation.amount} SOL` : JSON.stringify(json).slice(0, 160)}`)
  if (json?.donation) console.log(`follow        ${base}/gift/${json.donation.id}`)
  console.log(`explorer      https://explorer.solana.com/tx/${sig}?cluster=devnet`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
