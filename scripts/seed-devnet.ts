/**
 * Seeds REAL devnet state so no screen is ever empty and every number on the
 * site is verifiable on Solscan:
 *
 *  1. Creates on-chain campaigns + milestones for all six pools (authority key).
 *  2. Creates demo donor wallets (funded by the treasury) and makes real
 *     `donate` transactions into each vault.
 *  3. Creates two live staked dares on-chain.
 *  4. Mirrors everything into the database (profiles, posts, follows,
 *     certificates), uploads sample milestone evidence and opens one
 *     fund-release vote.
 *
 * Idempotent: safe to re-run. Usage: npm run seed
 */
import 'dotenv/config'
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'
import { CAUSES } from '../lib/causes'
import { getConnection } from '../lib/solana/chain'
import { getAuthorityKeypair, getTreasuryKeypair } from '../lib/solana/server-signer'
import { buildDonateIx, buildCreateDareIx } from '../lib/solana/instructions'
import { derivePoolAddresses } from '../lib/solana/pda'
import { createCampaignOnChain } from '../lib/solana/authority-ops'
import { ensureUser, claimHandle, findUserByUsername } from '../lib/data/users'
import { ensurePools, recordDonation } from '../lib/data/donations'
import { createPost, follow } from '../lib/data/social'
import { createDare, getDares } from '../lib/data/dares'
import { getCampaignByPool, setMilestoneEvidence, createMilestoneProposal, castVote } from '../lib/data/governance'
import { getDb, campaigns, milestones } from '../lib/db'
import { eq, and } from 'drizzle-orm'
import { syncPoolsFromChain } from '../lib/solana/sync'

const DEMO_DIR = path.join(process.cwd(), '.data', 'demo-wallets')

const DEMO_USERS = [
  { key: 'aisha', username: 'aisha_gives', displayName: 'Aisha Malik', bio: 'Humanitarian worker. Building a kinder world one donation at a time.' },
  { key: 'sol', username: 'sol_impact', displayName: 'Sol Impact', bio: 'Crypto native turned impact maker.' },
  { key: 'dev', username: 'charity_dev', displayName: 'Dev for Good', bio: 'Full-stack dev by day, philanthropist by night.' },
  { key: 'noor', username: 'noor_hope', displayName: 'Noor Al-Rashid', bio: 'Social worker. Proof that crypto can be a force for good.' },
  { key: 'whale', username: 'impact_whale', displayName: 'The Impact Whale', bio: 'Donating big. Voting bigger.' },
  { key: 'green', username: 'green_sol', displayName: 'Green Solana', bio: 'Environmental causes on-chain.' },
]

const CAMPAIGNS: Record<string, { target: number; days: number; milestones: { description: string; percentage: number }[] }> = {
  'palestine-red-crescent': { target: 10, days: 90, milestones: [{ description: 'Emergency medical supplies purchased for PRCS', percentage: 30 }, { description: 'Field clinic equipment delivered', percentage: 30 }, { description: 'Full medical aid package delivered, receipts published', percentage: 40 }] },
  'turkish-red-crescent': { target: 12, days: 90, milestones: [{ description: 'Emergency relief supplies procured for Kizilay', percentage: 40 }, { description: 'Shelter materials delivered to earthquake zones', percentage: 30 }, { description: 'Full donation delivered to Turkish Red Crescent', percentage: 30 }] },
  'mercy-corps': { target: 8, days: 60, milestones: [{ description: 'Water purification supplies purchased', percentage: 30 }, { description: 'Food security packages assembled', percentage: 35 }, { description: 'Full donation delivered to Mercy Corps', percentage: 35 }] },
  'edhi-foundation': { target: 8, days: 60, milestones: [{ description: 'Orphan care supplies purchased for Edhi Foundation', percentage: 30 }, { description: 'Medical equipment donated to Edhi ambulance service', percentage: 30 }, { description: 'Full donation delivered to Edhi Foundation', percentage: 40 }] },
  'orphanage-aid': { target: 2, days: 60, milestones: [{ description: 'School supplies and clothing purchased', percentage: 30 }, { description: 'Umanity team visits orphanage, photo and receipt proof', percentage: 35 }, { description: 'Full delivery complete with receipts', percentage: 35 }] },
  'animal-rescue': { target: 1.5, days: 45, milestones: [{ description: 'Animal food and vet supplies purchased', percentage: 35 }, { description: 'Umanity team feeds and treats street animals, video proof', percentage: 35 }, { description: 'Full rescue round complete with receipts', percentage: 30 }] },
}

function loadOrCreateWallet(key: string): Keypair {
  fs.mkdirSync(DEMO_DIR, { recursive: true })
  const file = path.join(DEMO_DIR, `${key}.json`)
  if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))))
  const kp = Keypair.generate()
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)))
  return kp
}

async function ensureFunded(kp: Keypair, minSol: number, from: Keypair) {
  const conn = getConnection()
  const bal = await conn.getBalance(kp.publicKey)
  if (bal >= minSol * LAMPORTS_PER_SOL) return
  const lamports = Math.round((minSol - bal / LAMPORTS_PER_SOL + 0.02) * LAMPORTS_PER_SOL)
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: kp.publicKey, lamports }))
  const sig = await sendAndConfirmTransaction(conn, tx, [from])
  console.log(`  funded ${kp.publicKey.toBase58().slice(0, 6)} with ${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL (${sig.slice(0, 12)}…)`)
}

async function donate(kp: Keypair, poolId: string, sol: number): Promise<string> {
  const conn = getConnection()
  const { ix } = await buildDonateIx(conn, poolId, kp.publicKey, Math.round(sol * LAMPORTS_PER_SOL))
  const tx = new Transaction().add(ix)
  return sendAndConfirmTransaction(conn, tx, [kp], { commitment: 'confirmed' })
}

async function main() {
  const authority = getAuthorityKeypair()
  const treasury = getTreasuryKeypair()
  if (!authority || !treasury) throw new Error('Authority/treasury keypairs not found (UMANITY_AUTHORITY_KEYPAIR / ~/.config/solana/devnet.json)')
  const conn = getConnection()
  console.log('Authority', authority.publicKey.toBase58(), (await conn.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL, 'SOL')
  await getDb()
  await ensurePools(derivePoolAddresses)

  // 1. Campaigns on-chain
  console.log('\n1. Campaigns + milestones on-chain')
  for (const cause of CAUSES) {
    const cfg = CAMPAIGNS[cause.id]
    const r = await createCampaignOnChain({ poolId: cause.id, targetSol: cfg.target, deadlineDays: cfg.days, milestones: cfg.milestones })
    console.log(`  ${cause.id}: campaign ${r.campaign.campaignPda?.slice(0, 8)}… ${r.createSignature ? 'created ' + r.createSignature.slice(0, 10) : 'exists'}`)
  }

  // 2. Demo users + donations
  console.log('\n2. Demo donors (real devnet transactions)')
  const wallets = new Map<string, Keypair>()
  for (const u of DEMO_USERS) {
    const kp = loadOrCreateWallet(u.key)
    wallets.set(u.key, kp)
    await ensureFunded(kp, 0.35, treasury.publicKey.equals(authority.publicKey) ? authority : authority)
    await ensureUser(kp.publicKey.toBase58())
    const existing = await findUserByUsername(u.username)
    if (!existing || existing.address === kp.publicKey.toBase58()) await claimHandle(kp.publicKey.toBase58(), u.username, u.displayName, u.bio)
  }
  const plan: [string, string, number][] = [
    ['aisha', 'palestine-red-crescent', 0.05],
    ['whale', 'palestine-red-crescent', 0.12],
    ['sol', 'turkish-red-crescent', 0.03],
    ['dev', 'mercy-corps', 0.04],
    ['noor', 'edhi-foundation', 0.05],
    ['whale', 'edhi-foundation', 0.08],
    ['green', 'animal-rescue', 0.03],
    ['noor', 'orphanage-aid', 0.04],
    ['aisha', 'orphanage-aid', 0.02],
    ['dev', 'animal-rescue', 0.02],
  ]
  const db = await getDb()
  const { donations } = await import('../lib/db')
  for (const [key, poolId, sol] of plan) {
    const kp = wallets.get(key)!
    const already = await db.select().from(donations).where(and(eq(donations.donorAddress, kp.publicKey.toBase58()), eq(donations.poolId, poolId))).limit(1)
    if (already.length) {
      console.log(`  ${key} → ${poolId}: already seeded`)
      continue
    }
    const sig = await donate(kp, poolId, sol)
    await recordDonation({ donorAddress: kp.publicKey.toBase58(), poolId, amountLamports: Math.round(sol * LAMPORTS_PER_SOL), signature: sig, route: 'solana' })
    console.log(`  ${key} donated ${sol} SOL → ${poolId} (${sig.slice(0, 12)}…)`)
  }

  // 3. Social graph + posts
  console.log('\n3. Social graph')
  const addr = (k: string) => wallets.get(k)!.publicKey.toBase58()
  const pairs: [string, string][] = [['aisha', 'sol'], ['aisha', 'noor'], ['sol', 'aisha'], ['sol', 'whale'], ['dev', 'sol'], ['noor', 'aisha'], ['whale', 'aisha'], ['green', 'noor'], ['whale', 'dev'], ['noor', 'green']]
  for (const [a, b] of pairs) await follow(addr(a), addr(b))
  const posts: [string, string][] = [
    ['sol', 'The governance here is the real thing: my votes decide when escrowed SOL leaves the vault. No theatre.'],
    ['dev', 'Read the Anchor program before donating. PDA vaults, milestone releases, dares settling into the cause. Clean.'],
    ['green', 'Street animal rescue pool is a field cause: the Umanity team buys the supplies themselves and posts receipts. That is the kind of proof I want.'],
    ['whale', 'Gave from Base USDC straight into the Edhi vault via NEAR Intents. No bridging, no wrapped tokens, one deposit address.'],
  ]
  const { posts: postsTable } = await import('../lib/db')
  for (const [k, content] of posts) {
    const existing = await db.select().from(postsTable).where(and(eq(postsTable.authorAddress, addr(k)), eq(postsTable.content, content))).limit(1)
    if (!existing.length) await createPost(addr(k), content, 'manual')
  }

  // 4. Dares on-chain
  console.log('\n4. Staked dares on-chain')
  const openDares = await getDares({ status: 'open', limit: 10 })
  if (openDares.length < 2) {
    const dareSpecs = [
      { from: 'aisha', target: 'sol_impact', pool: 'edhi-foundation', text: 'Match my 0.05 SOL to Edhi Foundation before the weekend', stake: 0.05, hours: 48 },
      { from: 'whale', target: 'charity_dev', pool: 'orphanage-aid', text: 'Donate 0.1 SOL to the orphanage pool and post the receipt', stake: 0.1, hours: 72 },
    ]
    for (const d of dareSpecs) {
      const kp = wallets.get(d.from)!
      const targetUser = await findUserByUsername(d.target)
      const { ix, darePda } = await buildCreateDareIx(d.pool, kp.publicKey, { targetHandle: d.target, text: d.text, stakeLamports: Math.round(d.stake * LAMPORTS_PER_SOL), durationSecs: d.hours * 3600, targetWallet: targetUser ? new PublicKey(targetUser.address) : null })
      const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [kp], { commitment: 'confirmed' })
      await createDare({ creatorAddress: kp.publicKey.toBase58(), targetHandle: d.target, poolId: d.pool, text: d.text, stakeLamports: Math.round(d.stake * LAMPORTS_PER_SOL), hours: d.hours, darePda: darePda.toBase58(), createTxSignature: sig })
      console.log(`  ${d.from} dared @${d.target}: ${d.stake} SOL (${sig.slice(0, 12)}…)`)
    }
  } else console.log('  dares already seeded')

  // 5. Evidence + a live fund-release vote on the orphanage pool (field cause)
  console.log('\n5. Evidence + fund-release vote')
  const orphan = await getCampaignByPool('orphanage-aid')
  if (orphan) {
    const m0 = orphan.milestones[0]
    if (m0 && !m0.evidence) {
      await setMilestoneEvidence(m0.id, {
        summary: 'Purchased school supplies (notebooks, pens, bags) and winter clothing for 24 children at the orphanage. Receipts from two local shops attached, photos geotagged at the delivery.',
        items: [
          { kind: 'receipt', url: 'https://umanity.xyz/proof/orphanage-aid/receipt-1.jpg', sha256: '9f2c1d1c4b4e7a0d4f3a6b2c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e', note: 'Stationery shop, PKR 18,400' },
          { kind: 'receipt', url: 'https://umanity.xyz/proof/orphanage-aid/receipt-2.jpg', sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', note: 'Clothing, PKR 26,900' },
          { kind: 'photo', url: 'https://umanity.xyz/proof/orphanage-aid/delivery-1.jpg', lat: 24.8607, lng: 67.0011, note: 'Delivery at the orphanage, team on site' },
          { kind: 'video', url: 'https://umanity.xyz/proof/orphanage-aid/delivery.mp4', note: '48s walkthrough' },
        ],
        submittedBy: 'Umanity field team',
      })
    }
    const db2 = await getDb()
    const camp = (await db2.select().from(campaigns).where(eq(campaigns.poolId, 'orphanage-aid')).limit(1))[0]
    const ms = (await db2.select().from(milestones).where(and(eq(milestones.campaignId, camp.id), eq(milestones.index, 0))).limit(1))[0]
    if (ms && ms.status === 'pending') {
      const p = await createMilestoneProposal(camp, ms, authority.publicKey.toBase58(), 96)
      for (const k of ['aisha', 'noor', 'whale']) await castVote(p.id, addr(k), 0).catch(() => {})
      await castVote(p.id, addr('dev'), 1).catch(() => {})
      console.log(`  proposal ${p.id} opened with 4 votes`)
    } else console.log('  milestone already in', ms?.status)
  }

  await syncPoolsFromChain(10_000)
  console.log('\nDone. Pools synced from chain.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
