/**
 * Autonomous agent paying for the AI Impact Oracle over x402 (Solana devnet).
 *
 *   SOLANA_AGENT_SECRET='[...]' npx tsx scripts/x402-agent.ts <milestoneId> [baseUrl]
 *
 * The agent needs devnet USDC (https://faucet.circle.com). It never needs SOL:
 * the facilitator pays the network fee. Flow: request → 402 → sign USDC
 * transfer → retry with PAYMENT-SIGNATURE → 200 + PAYMENT-RESPONSE (tx sig).
 */
import 'dotenv/config'
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { createKeyPairSignerFromBytes } from '@solana/kit'

async function main() {
  const [milestoneId, base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'] = process.argv.slice(2)
  if (!milestoneId) throw new Error('usage: x402-agent.ts <milestoneId> [baseUrl]')
  const secret = process.env.SOLANA_AGENT_SECRET
  if (!secret) throw new Error('SOLANA_AGENT_SECRET (JSON array) required')
  const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(secret)))
  console.log('agent', signer.address)

  const client = new x402Client().register('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', new ExactSvmScheme(signer))
  const payFetch = wrapFetchWithPayment(fetch, client)

  const url = `${base}/api/x402/verify-milestone`
  const first = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneId }) })
  console.log('unpaid →', first.status, first.headers.get('payment-required') ? '(PAYMENT-REQUIRED present)' : '')

  const res = await payFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneId }) })
  console.log('paid   →', res.status)
  const pr = res.headers.get('payment-response')
  if (pr) console.log('settlement', decodePaymentResponseHeader(pr))
  console.log(JSON.stringify(await res.json(), null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
