/**
 * Sets up and runs Umanity program v3 on the cluster in NEXT_PUBLIC_SOLANA_NETWORK.
 * Signs with the authority keypair (UMANITY_AUTHORITY_KEYPAIR[_PATH]).
 *
 *   npx tsx scripts/umanity-setup.ts status
 *   npx tsx scripts/umanity-setup.ts init --ops <pubkey> [--release <pubkey>] [--max-pot 2000] [--review-hours 6]
 *   npx tsx scripts/umanity-setup.ts drop <meta.json> --goal 750 --cap 1000 --deadline 2026-11-07T18:00:00Z --payee <pubkey>
 *   npx tsx scripts/umanity-setup.ts sync
 *
 * `drop` hashes the description file (see lib/umanity/drops.ts DropMeta),
 * creates the drop on-chain with that hash, and stores the exact bytes in
 * the database so anyone can check them against the chain.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import fs from 'fs'
import { BN } from '@coral-xyz/anchor'
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from '@solana/web3.js'
import { getAuthorityKeypair } from '../lib/solana/server-signer'
import { getConnection } from '../lib/solana/chain'
import { SOLANA_CLUSTER } from '../lib/solana/constants'
import { drops, getDb } from '../lib/db'
import {
  CONFIG,
  DROPS_FUND,
  FEE_INBOX,
  FEES,
  USDC,
  UMANITY_PROGRAM_ID,
  createDropIx,
  dropAddress,
  fetchConfig,
  fetchDrops,
  micro,
  tokenBalance,
  umanityProgram,
  usd,
} from '../lib/umanity/program'
import { canonicalJson, hexToBytes, listTotal, sha256Hex, validateMeta, type DropMeta } from '../lib/umanity/drops'
import { syncChain } from '../lib/umanity/indexer'

const UPGRADEABLE_LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')

function flag(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`)
  const v = i > 0 ? process.argv[i + 1] : undefined
  if (v === undefined && fallback === undefined) throw new Error(`--${name} is required`)
  return v ?? fallback!
}

async function send(authority: Keypair, ixs: TransactionInstruction[]) {
  const conn = getConnection()
  return sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [authority], { commitment: 'confirmed' })
}

async function status() {
  const conn = getConnection()
  const config = await fetchConfig(conn)
  console.log(`cluster ${SOLANA_CLUSTER} · program ${UMANITY_PROGRAM_ID.toBase58()} · USDC ${USDC.toBase58()}`)
  if (!config) return console.log('not initialised: run `init`')
  console.log({
    ...config,
    maxPot: usd(config.maxPot),
    feesSplit: usd(config.feesSplit),
    fundIn: usd(config.fundIn),
    fundOut: usd(config.fundOut),
    fundBack: usd(config.fundBack),
    opsOut: usd(config.opsOut),
  })
  console.log(`fee inbox ${FEE_INBOX.toBase58()} $${usd(await tokenBalance(conn, FEE_INBOX))}`)
  console.log(`drops fund ${DROPS_FUND.toBase58()} $${usd(await tokenBalance(conn, DROPS_FUND))}`)
  for (const d of await fetchDrops(conn)) {
    console.log(`drop ${d.id} ${d.state} pot ${d.pot} given $${usd(d.given)} of $${usd(d.goal)} · ${d.backers} backers · due ${new Date(d.deadline * 1000).toISOString()}`)
  }
}

async function init(authority: Keypair) {
  const conn = getConnection()
  const ops = new PublicKey(flag('ops'))
  const release = new PublicKey(flag('release', authority.publicKey.toBase58()))
  const maxPot = micro(Number(flag('max-pot', '2000')))
  const reviewSecs = Math.round(Number(flag('review-hours', '6')) * 3600)
  const programData = PublicKey.findProgramAddressSync([UMANITY_PROGRAM_ID.toBuffer()], UPGRADEABLE_LOADER)[0]
  const ix = await umanityProgram(conn)
    .methods.initConfig(release, ops, new BN(maxPot.toString()), new BN(reviewSecs))
    .accountsPartial({
      config: CONFIG,
      fees: FEES,
      feeInbox: FEE_INBOX,
      dropsFund: DROPS_FUND,
      usdcMint: USDC,
      admin: authority.publicKey,
      program: UMANITY_PROGRAM_ID,
      programData,
    })
    .instruction()
  console.log('init_config', await send(authority, [ix]))
}

async function createDrop(authority: Keypair) {
  const conn = getConnection()
  const file = process.argv[3]
  if (!file || file.startsWith('--')) throw new Error('usage: drop <meta.json> --goal --cap --deadline --payee')
  const meta = JSON.parse(fs.readFileSync(file, 'utf8')) as DropMeta
  const problem = validateMeta(meta)
  if (problem) throw new Error(`description: ${problem}`)
  const text = canonicalJson(meta)
  const metaHash = await sha256Hex(text)

  const goal = micro(Number(flag('goal')))
  const cap = micro(Number(flag('cap')))
  const deadline = Math.floor(new Date(flag('deadline')).getTime() / 1000)
  const payee = new PublicKey(flag('payee'))
  const config = await fetchConfig(conn)
  if (!config) throw new Error('run `init` first')
  const id = config.dropCount
  console.log(`drop ${id}: "${meta.title}", list total $${listTotal(meta.items)}, goal $${usd(goal)}, cap $${usd(cap)}, hash ${metaHash}`)

  const sig = await send(authority, [await createDropIx(conn, { id, admin: authority.publicKey, goal, cap, deadline, payee, metaHash: hexToBytes(metaHash) })])
  const db = await getDb()
  await db
    .insert(drops)
    .values({
      id,
      cluster: SOLANA_CLUSTER,
      address: dropAddress(id).toBase58(),
      title: meta.title,
      place: meta.place,
      story: meta.story,
      emoji: meta.emoji,
      items: meta.items,
      unitName: meta.unit.name,
      unitCents: Math.round(meta.unit.usd * 100),
      peoplePerUnit: meta.unit.people,
      meta: text,
      metaHash,
      goalMicro: Number(goal),
      capMicro: Number(cap),
      deadline: new Date(deadline * 1000),
      payee: payee.toBase58(),
      createdTx: sig,
    })
    .onConflictDoNothing()
  console.log('create_drop', sig)
}

async function main() {
  const cmd = process.argv[2] ?? 'status'
  if (cmd === 'status') return status()
  if (cmd === 'sync') return console.log(await syncChain(getConnection()))
  const authority = getAuthorityKeypair()
  if (!authority) throw new Error('authority keypair not found (UMANITY_AUTHORITY_KEYPAIR / UMANITY_AUTHORITY_KEYPAIR_PATH)')
  const sol = (await getConnection().getBalance(authority.publicKey)) / LAMPORTS_PER_SOL
  console.log(`authority ${authority.publicKey.toBase58()} · ${sol} SOL`)
  if (cmd === 'init') return init(authority)
  if (cmd === 'drop') return createDrop(authority)
  throw new Error(`unknown command ${cmd}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
