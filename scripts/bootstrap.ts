/**
 * Creates the on-chain pools, campaigns and milestones for every cause and
 * mirrors them into the database. Safe to re-run. Stop the dev server first
 * when using the embedded PGlite database (one process at a time).
 *
 *   npm run bootstrap
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAuthorityKeypair } from '../lib/solana/server-signer'
import { getConnection } from '../lib/solana/chain'
import { bootstrapCauses, campaignTargetScale } from '../lib/solana/bootstrap'
import { SOLANA_CLUSTER } from '../lib/solana/constants'
import { getDb } from '../lib/db'

async function main() {
  const authority = getAuthorityKeypair()
  if (!authority) throw new Error('Authority keypair not found (UMANITY_AUTHORITY_KEYPAIR / UMANITY_AUTHORITY_KEYPAIR_PATH)')
  const conn = getConnection()
  console.log(`Cluster ${SOLANA_CLUSTER} · authority ${authority.publicKey.toBase58()} · ${(await conn.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL} SOL · target scale ${campaignTargetScale()}`)
  await getDb()
  const steps = await bootstrapCauses((l) => console.log('  ' + l))
  console.log(`\nDone: ${steps.filter((s) => s.pool === 'created').length} pools and ${steps.filter((s) => s.campaign === 'created').length} campaigns created, database synced.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
