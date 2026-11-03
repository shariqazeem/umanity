/**
 * Exercises the Give API's failure handling against a running server (devnet).
 *
 *   npx tsx scripts/x402-failures.ts [baseUrl]
 *
 *   1. invalid body              → 400, never asked to pay
 *   2. valid body, no payment    → 402 + PAYMENT-REQUIRED
 *   3. signed payment            → 200 + PAYMENT-RESPONSE (settled on Solana)
 *   4. the same payment replayed → 409 payment_already_used (handler never runs twice)
 *
 * Uses ~/.config/solana/devnet.json (or SOLANA_AGENT_SECRET) as the agent; it needs a little devnet USDC.
 */
import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { x402Client, x402HTTPClient } from '@x402/fetch'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { createKeyPairSignerFromBytes } from '@solana/kit'

async function main() {
  const base = `${process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/x402/give`
  const json = { 'content-type': 'application/json' }
  const secret = process.env.SOLANA_AGENT_SECRET ?? fs.readFileSync(path.join(os.homedir(), '.config/solana/devnet.json'), 'utf8')
  const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(secret)))
  const http = new x402HTTPClient(new x402Client().register('solana:*', new ExactSvmScheme(signer)).setSpendControls({ maxAmountPerPayment: '$5' }))

  const bad = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ causeId: 'nope', amountUsd: 1 }) })
  console.log('1. invalid body      →', bad.status, (await bad.json()).error)

  const body = JSON.stringify({ causeId: 'family-meals', amountUsd: 0.11, agent: 'failure-test' })
  const unpaid = await fetch(base, { method: 'POST', headers: json, body })
  console.log('2. no payment        →', unpaid.status, unpaid.headers.get('payment-required') ? 'PAYMENT-REQUIRED present' : '')

  const required = http.getPaymentRequiredResponse((n) => unpaid.headers.get(n), await unpaid.json())
  const headers = http.encodePaymentSignatureHeader(await http.createPaymentPayload(required))
  const paid = await fetch(base, { method: 'POST', headers: { ...json, ...headers }, body })
  const receipt = (await paid.json()).receipt
  console.log('3. paid              →', paid.status, receipt?.settlement?.transaction ?? '(no settlement)')

  // Refused either by the facilitator (already-settled transfer → 402) or by our replay guard (409).
  const replay = await fetch(base, { method: 'POST', headers: { ...json, ...headers }, body })
  const rj = (await replay.json().catch(() => ({}))) as { error?: string }
  const pr = replay.headers.get('payment-required')
  const why = rj.error ?? (pr ? (JSON.parse(Buffer.from(pr, 'base64').toString('utf8')) as { error?: string }).error : undefined)
  console.log('4. same payment again →', replay.status, why ?? '')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
