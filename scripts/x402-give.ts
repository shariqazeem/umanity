/**
 * An autonomous agent giving to a Umanity cause over x402 (USDC on Solana).
 *
 *   SOLANA_AGENT_SECRET='[...]' npx tsx scripts/x402-give.ts <dropNumber> <amountUsd> [agentName] [baseUrl]
 *   npx tsx scripts/x402-give.ts clean-water 0.25 my-agent              # uses ~/.config/solana/devnet.json
 *
 * The agent needs devnet USDC (https://faucet.circle.com) and no SOL: the
 * facilitator pays the network fee. Flow: POST → 402 (PAYMENT-REQUIRED) →
 * sign a USDC transfer → retry with PAYMENT-SIGNATURE → 200 + PAYMENT-RESPONSE.
 */
import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { createKeyPairSignerFromBytes } from '@solana/kit'

function loadSecret(): Uint8Array {
  const raw = process.env.SOLANA_AGENT_SECRET ?? fs.readFileSync(path.join(os.homedir(), '.config/solana/devnet.json'), 'utf8')
  return Uint8Array.from(JSON.parse(raw))
}

async function main() {
  const [drop = '1', amount = '1', agent = 'umanity-agent-script', base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'] = process.argv.slice(2)
  const signer = await createKeyPairSignerFromBytes(loadSecret())
  console.log(`agent wallet  ${signer.address}`)

  const url = `${base}/api/x402/give`
  const body = JSON.stringify({ drop: Number(drop), amountUsd: Number(amount), agent })

  // 1. Ask without paying: the server states the price.
  const first = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  const challenge = first.headers.get('payment-required')
  console.log(`unpaid        HTTP ${first.status}`)
  if (challenge) {
    const req = JSON.parse(Buffer.from(challenge, 'base64').toString('utf8'))
    const a = req.accepts?.[0]
    console.log(`challenge     ${a?.scheme} · ${a?.network} · ${Number(a?.amount) / 1e6} USDC → ${a?.payTo}`)
  }

  // 2. Pay and retry in one call.
  const client = new x402Client().register('solana:*', new ExactSvmScheme(signer)).setSpendControls({ maxAmountPerPayment: '$250' })
  const pay = wrapFetchWithPayment(fetch, client)
  const res = await pay(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  console.log(`paid          HTTP ${res.status}`)
  const pr = res.headers.get('payment-response')
  if (pr) console.log('settlement   ', decodePaymentResponseHeader(pr))
  console.log(JSON.stringify(await res.json(), null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
