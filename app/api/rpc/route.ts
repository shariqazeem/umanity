/**
 * The browser's Solana RPC when NEXT_PUBLIC_SOLANA_RPC_PROXY=1 (mainnet). It forwards
 * JSON-RPC to SOLANA_RPC_URL, so the RPC provider's key never ships to the page, and it
 * passes only the reads and sends the app makes: no getProgramAccounts, no batches over 10.
 */
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/api'
import { SERVER_RPC } from '@/lib/solana/chain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getEpochInfo',
  'getFeeForMessage',
  'getGenesisHash',
  'getHealth',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getRecentPrioritizationFees',
  'getSignatureStatuses',
  'getSignaturesForAddress',
  'getSlot',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTokenSupply',
  'getTransaction',
  'getVersion',
  'isBlockhashValid',
  'sendTransaction',
  'simulateTransaction',
])
const MAX_BODY = 64 * 1024
const MAX_BATCH = 10

const rpcError = (id: unknown, code: number, message: string) => NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export async function POST(req: NextRequest) {
  if (!rateLimit(`rpc:${clientIp(req)}`, 600, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const text = await req.text()
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'Request too large' }, { status: 413 })

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }
  const calls = (Array.isArray(body) ? body : [body]) as { id?: unknown; method?: unknown }[]
  if (calls.length === 0 || calls.length > MAX_BATCH) return rpcError(null, -32600, 'Invalid request')
  const refused = calls.find((c) => typeof c?.method !== 'string' || !ALLOWED.has(c.method))
  if (refused) return rpcError(refused?.id, -32601, `Method not allowed: ${String(refused?.method)}`)

  try {
    const res = await fetch(SERVER_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, cache: 'no-store' })
    return new NextResponse(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch {
    return rpcError(calls[0]?.id, -32603, 'The Solana RPC is unreachable; try again')
  }
}
