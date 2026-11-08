/**
 * A guarded release, end to end: a local Solana validator runs the real
 * Umanity program with the NEAR guard's MPC-derived key as its release
 * authority; the guard on NEAR testnet checks a signed verdict, waits out the
 * council's window and has NEAR's testnet MPC network sign the unlock.
 *
 * The verdict is signed by a TEST key standing in for NEAR AI's TEE (the real
 * check needs a NEAR AI API key). It is registered on the testnet guard for
 * this run only and removed at the end.
 *
 *   bash scripts/guard-e2e.sh
 *
 * Env: GUARD (guard.umanity.testnet), NEAR_OWNER (umanity.testnet), NEAR_BOT
 * (bot.umanity.testnet); their keys come from the NEAR CLI's legacy keychain
 * (~/.near-credentials/testnet). ANCHOR_WALLET: the local validator's payer.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import nacl from 'tweetnacl'
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from '@solana/web3.js'
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'

const GUARD = process.env.GUARD || 'guard.umanity.testnet'
const OWNER = process.env.NEAR_OWNER || 'umanity.testnet'
const BOT = process.env.NEAR_BOT || 'bot.umanity.testnet'
const cred = (id: string) => JSON.parse(fs.readFileSync(path.join(os.homedir(), '.near-credentials/testnet', `${id}.json`), 'utf8')).private_key as string
const mint = Keypair.generate()
// The app's modules read these when they load, so they are imported below, after this.
Object.assign(process.env, {
  NEXT_PUBLIC_SOLANA_NETWORK: 'devnet',
  NEXT_PUBLIC_SOLANA_RPC: 'http://127.0.0.1:8899',
  NEXT_PUBLIC_UMANITY_USDC_MINT: mint.publicKey.toBase58(),
  NEAR_NETWORK: 'testnet',
  NEAR_GUARD_CONTRACT: GUARD,
  NEAR_ACCOUNT_ID: BOT,
  NEAR_PRIVATE_KEY: cred(BOT),
})

async function main() {
const P = await import('@/lib/umanity/program')
const D = await import('@/lib/umanity/drops')
const G = await import('@/lib/near/guard')
const C = await import('@/lib/near/client')
const K = await import('@/lib/near/checker')
const R = await import('@/lib/near/release')

const MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct'
const MODEL_KEY = 'c6eb7050db6f17486e179a0b393b73430e2db4e08d4dfb5d8fa1f8e2f8d98b6d'
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex')
const bytes = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'))
const step = (s: string) => console.log(`\n▸ ${s}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const conn = new Connection('http://127.0.0.1:8899', 'confirmed')
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET || path.join(os.homedir(), '.config/solana/devnet.json'), 'utf8'))))
const send = (ixs: TransactionInstruction[], signers = [admin]) => sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' })
const owner = C.nearAccount(OWNER, cred(OWNER))
const ownerCall = (method: string, args: Record<string, unknown>) => C.callAndWait(owner, { contractId: GUARD, method, args, tgas: 30 })

step('Guard config (release key read from the MPC contract)')
let guard = await G.guardConfig()
if (!guard.release_key) {
  // Anyone may ask the guard to read its key from the MPC contract.
  await C.callAndWait(C.botAccount()!, { contractId: GUARD, method: 'sync_release_key', args: {}, tgas: 50 })
  guard = await G.guardConfig()
}
console.log('  release key', guard.release_key, '| council', guard.council.join(','), '| review', Number(guard.review_ms) / 1000, 's')
const releaseKey = new PublicKey(guard.release_key!)

step('Local Solana: USDC mint, program config with the guard as release authority (review 5 s)')
await createMint(conn, admin, admin.publicKey, null, 6, mint)
const [programData] = PublicKey.findProgramAddressSync([P.UMANITY_PROGRAM_ID.toBuffer()], new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'))
const initIx = await P.umanityProgram(conn)
  .methods.initConfig(releaseKey, admin.publicKey, new BN(2_000_000_000), new BN(5))
  .accountsPartial({ config: P.CONFIG, usdcMint: mint.publicKey, fees: P.FEES, feeInbox: P.FEE_INBOX, dropsFund: P.DROPS_FUND, program: P.UMANITY_PROGRAM_ID, programData, admin: admin.publicKey })
  .instruction()
await send([initIx])
const config = await P.fetchConfig(conn)
console.log('  program release authority', config!.releaseAuthority, config!.releaseAuthority === guard.release_key ? '= guard key ✓' : '✗')

step('A drop, a $2 gift, and proof')
const meta = { title: 'Rice for 2 families', place: 'Gulberg, Lahore', story: 'Two 5 kg bags of rice for two families.', emoji: '🍚', items: [{ name: 'Rice 5 kg bag', qty: 2 }], unit: { name: 'bag of rice', usd: 1, people: 5 } }
const metaText = D.canonicalJson(meta)
const metaHash = sha(metaText)
const id = config!.dropCount
const payee = Keypair.generate().publicKey
await send([await P.createDropIx(conn, { id, admin: admin.publicKey, goal: 1_000_000n, cap: 10_000_000n, deadline: Math.floor(Date.now() / 1000) + 3 * 3600, payee, metaHash: bytes(metaHash) })])
const adminUsdc = await getOrCreateAssociatedTokenAccount(conn, admin, mint.publicKey, admin.publicKey)
await mintTo(conn, admin, mint.publicKey, adminUsdc.address, admin, 5_000_000)
await send([await P.giveIx(conn, { dropId: id, giver: admin.publicKey, amount: 2_000_000n, ref: randomBytes(16) })])
const bundle = D.canonicalJson({ v: 1, drop: id, title: 'Delivered', body: 'Two bags handed over at Gulberg.', xPostUrl: null, media: [{ url: 'https://umanity.vercel.app/proof/rice-1.jpg', kind: 'photo', sha256: null }], at: new Date().toISOString() })
const proof = sha(bundle)
await send([await P.postProofIx(conn, { dropId: id, admin: admin.publicKey, proofHash: bytes(proof) })])
console.log('  drop', id, P.dropAddress(id).toBase58(), '| pot $', P.usd(await P.tokenBalance(conn, P.potAddress(id))), '| proof', proof.slice(0, 16) + '…')

step('NEAR (owner): checker, TEE keys (+ a TEST key for this run), registrar')
await ownerCall('set_checker', { model: MODEL, system: K.CHECKER_SYSTEM, params: K.CHECKER_PARAMS })
const testTee = nacl.sign.keyPair()
await ownerCall('set_ai_signers', { signers: [MODEL_KEY, hex(testTee.publicKey)] })
await ownerCall('set_registrar', { registrar: BOT })

try {
  step('NEAR (bot): register the drop, then the signed verdict')
  const reg = await G.registerDrop(id, P.dropAddress(id).toBase58(), metaHash)
  console.log('  registered', reg.txHash)
  const request = await G.checkerRequest(id, metaText, bundle)
  console.log('  request', request.length, 'bytes; images:', (JSON.parse(request).messages[1].content as unknown[]).length - 1)
  const response = JSON.stringify({ id: 'chatcmpl-e2e', object: 'chat.completion', model: MODEL, choices: [{ index: 0, message: { role: 'assistant', content: 'VERDICT: APPROVE\nREASON: Two bags of rice handed over at Gulberg, as promised.' }, finish_reason: 'stop' }] })
  const signature = hex(nacl.sign.detached(Buffer.from(`${MODEL}:${sha(request)}:${sha(response)}`), testTee.secretKey))
  const { value: verdict, txHash } = await G.submitVerdict({ dropId: id, meta: metaText, bundle, response, signer: hex(testTee.publicKey), signature })
  console.log('  verdict', verdict.approve ? 'APPROVE' : 'REJECT', '|', verdict.reason, '| tx', txHash)

  step('Too early: the guard refuses while the council can still veto')
  try {
    await R.releaseThroughGuard(conn, id, admin)
    console.log('  ✗ released early')
  } catch (e) {
    console.log('  refused ✓:', (e as Error).message)
  }

  step('A forged answer is refused on-chain')
  try {
    const bundle2 = bundle.replace('Two bags', 'Two big bags')
    await G.submitVerdict({ dropId: id, meta: metaText, bundle: bundle2, response, signer: hex(testTee.publicKey), signature })
    console.log('  ✗ accepted a signature over another request')
  } catch (e) {
    console.log('  refused ✓:', (e as Error).message)
  }

  const wait = Number(verdict.review_ends_ms) - Date.now() + 3000
  step(`Waiting ${Math.round(wait / 1000)} s for the council's window to close`)
  await sleep(Math.max(0, wait))

  step('Release: the guard checks the message, NEAR MPC signs it, Solana pays the payee')
  const t0 = Date.now()
  const out = await R.releaseThroughGuard(conn, id, admin)
  console.log('  NEAR tx', out.nearTx, `(${Math.round((Date.now() - t0) / 1000)} s)`)
  console.log('  Solana unlock', out.signature)
  const after = await P.fetchDrop(conn, id)
  const paid = await P.tokenBalance(conn, P.usdcAccount(payee))
  console.log('  drop state', after!.state, '| payee received $', P.usd(paid), after!.state === 'unlocked' && paid === 2_000_000n ? '✓' : '✗')
  const v = await G.guardVerdict(id, proof)
  console.log('  releases signed for this proof:', v!.releases_signed)
} finally {
  step('Cleanup: only the real model key stays registered')
  await ownerCall('set_ai_signers', { signers: [MODEL_KEY] })
  console.log('  ai_signers', (await G.guardConfig()).ai_signers)
}
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
