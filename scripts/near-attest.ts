/**
 * Checks the TEE key the NEAR guard trusts. Fetches NEAR AI Cloud's
 * attestation report for the checker model with a fresh nonce, confirms the
 * Intel TDX quote commits to the model's ed25519 signing key and that nonce,
 * and that this key and model are what the guard has registered.
 *
 *   NEAR_GUARD_CONTRACT=guard.umanity.testnet npx tsx scripts/near-attest.ts
 *
 * What this does not do: verify the quote's own signature chain up to Intel,
 * the event log against RTMR3, or the GPU's NVIDIA attestation. NEAR AI's
 * verification guide covers those (docs.near.ai, cloud/verification).
 */
import { randomBytes } from 'crypto'

type ModelAttestation = { model_name: string; signing_address: string; signing_algo: string; intel_quote: string; request_nonce?: string }

async function main() {
  const { GUARD_CONTRACT, NEAR_AI_MODEL, NEAR_AI_URL } = await import('@/lib/near/config')
  const { guardConfig } = await import('@/lib/near/guard')
  const config = GUARD_CONTRACT ? await guardConfig() : null
  const model = config?.checker?.model ?? NEAR_AI_MODEL
  const nonce = randomBytes(32).toString('hex')

  const res = await fetch(`${NEAR_AI_URL}/attestation/report?model=${encodeURIComponent(model)}&provider=near&signing_algo=ed25519&nonce=${nonce}`, { headers: { 'x-no-aliasing': 'true' } })
  if (!res.ok) throw new Error(`NEAR AI answered ${res.status}`)
  const report = (await res.json()) as { model_attestations?: ModelAttestation[] }
  const m = report.model_attestations?.find((a) => a.model_name === model)
  if (!m) throw new Error(`No attestation for ${model}`)

  // TDX quote v4: a 48-byte header, then the TD report, whose last 64 bytes (offset 568) are the report data.
  const quote = Buffer.from(m.intel_quote.replace(/^0x/, ''), 'hex')
  const version = quote.readUInt16LE(0)
  const teeType = quote.readUInt32LE(4)
  const reportData = quote.subarray(568, 632).toString('hex')
  const key = m.signing_address.replace(/^0x/, '').toLowerCase()

  const checks: [string, boolean][] = [
    ['an Intel TDX quote (v4, TEE type 0x81)', version === 4 && teeType === 0x81],
    ['ed25519 signing key', m.signing_algo === 'ed25519' && /^[0-9a-f]{64}$/.test(key)],
    ['the quote commits to this key', reportData.slice(0, 64) === key],
    ['the quote commits to our fresh nonce', reportData.slice(64) === nonce],
  ]
  if (config) {
    checks.push([`the guard's checker uses ${model}`, config.checker?.model === model])
    checks.push(['the guard trusts this key', config.ai_signers.includes(key)])
  }
  console.log(`${model}\nsigning key ${key}\n`)
  for (const [what, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${what}`)
  if (checks.some(([, ok]) => !ok)) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
