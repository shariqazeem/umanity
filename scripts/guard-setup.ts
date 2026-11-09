/**
 * Configures a NEAR guard right after its deploy, with the same code the app uses:
 *   1. sync_release_key: the guard reads its Solana release key from the MPC network
 *   2. set_checker: the AI model and the instructions in lib/near/checker.ts
 *   3. set_ai_signers: the model's TEE key, but only after NEAR AI's attestation report,
 *      fetched with a fresh nonce, shows an Intel TDX quote that commits to that key
 *   4. set_registrar: the server bot, which can register drops and nothing else
 *
 *   NEAR_NETWORK=mainnet NEAR_GUARD_CONTRACT=guard.umanity.near NEAR_OWNER=umanity.near NEAR_BOT=bot.umanity.near npx tsx scripts/guard-setup.ts
 *
 * Keys come from the NEAR CLI's legacy keychain (~/.near-credentials/<network>).
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomBytes } from 'crypto'

const NETWORK = process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
const GUARD = process.env.NEAR_GUARD_CONTRACT || `guard.umanity.${NETWORK === 'mainnet' ? 'near' : 'testnet'}`
const OWNER = process.env.NEAR_OWNER || `umanity.${NETWORK === 'mainnet' ? 'near' : 'testnet'}`
const BOT = process.env.NEAR_BOT || `bot.umanity.${NETWORK === 'mainnet' ? 'near' : 'testnet'}`
const key = (id: string) => JSON.parse(fs.readFileSync(path.join(os.homedir(), '.near-credentials', NETWORK, `${id}.json`), 'utf8')).private_key as string
// lib/near reads these when it loads, so it is imported after this.
Object.assign(process.env, { NEAR_NETWORK: NETWORK, NEAR_GUARD_CONTRACT: GUARD })

type ModelAttestation = { model_name: string; signing_address: string; signing_algo: string; intel_quote: string }

/** The model's ed25519 key, once the TDX quote (v4, TEE type 0x81) commits to it and to our nonce. */
async function attestedKey(base: string, model: string) {
  const nonce = randomBytes(32).toString('hex')
  const res = await fetch(`${base}/attestation/report?model=${encodeURIComponent(model)}&provider=near&signing_algo=ed25519&nonce=${nonce}`, { headers: { 'x-no-aliasing': 'true' } })
  if (!res.ok) throw new Error(`NEAR AI answered ${res.status}`)
  const m = ((await res.json()) as { model_attestations?: ModelAttestation[] }).model_attestations?.find((a) => a.model_name === model)
  if (!m) throw new Error(`No attestation for ${model}`)
  const quote = Buffer.from(m.intel_quote.replace(/^0x/, ''), 'hex')
  const reportData = quote.subarray(568, 632).toString('hex')
  const signer = m.signing_address.replace(/^0x/, '').toLowerCase()
  if (quote.readUInt16LE(0) !== 4 || quote.readUInt32LE(4) !== 0x81) throw new Error('Not an Intel TDX v4 quote')
  if (m.signing_algo !== 'ed25519' || !/^[0-9a-f]{64}$/.test(signer)) throw new Error('Not an ed25519 key')
  if (reportData !== signer + nonce) throw new Error('The quote does not commit to this key and our nonce')
  return signer
}

async function main() {
  const { NEAR_AI_MODEL, NEAR_AI_URL } = await import('@/lib/near/config')
  const C = await import('@/lib/near/client')
  const G = await import('@/lib/near/guard')
  const K = await import('@/lib/near/checker')
  const owner = C.nearAccount(OWNER, key(OWNER))
  const call = async (method: string, args: Record<string, unknown>, tgas = 30) => {
    const { txHash } = await C.callAndWait(owner, { contractId: GUARD, method, args, tgas })
    console.log(`  ${method} ${txHash}`)
  }
  console.log(`guard ${GUARD} on NEAR ${NETWORK} · owner ${OWNER} · registrar ${BOT}`)

  if (!(await G.guardConfig()).release_key) await call('sync_release_key', {}, 50)
  await call('set_checker', { model: NEAR_AI_MODEL, system: K.CHECKER_SYSTEM, params: K.CHECKER_PARAMS })
  const signer = await attestedKey(NEAR_AI_URL, NEAR_AI_MODEL)
  console.log(`  attested TEE key for ${NEAR_AI_MODEL}: ${signer}`)
  await call('set_ai_signers', { signers: [signer] })
  await call('set_registrar', { registrar: BOT })

  const c = await G.guardConfig()
  console.log({ ...c, checker: c.checker ? { model: c.checker.model, params: c.checker.params, system: `${c.checker.system.length} chars` } : null })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
