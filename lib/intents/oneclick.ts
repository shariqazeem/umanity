/**
 * NEAR Intents 1Click API client (what Aurora Intents' Swap API is built on).
 *
 * Mainnet only (there is no testnet). Dry quotes are free and need no key.
 * With AURORA_API_KEY set we talk to Aurora's proxy so the integrator fee
 * configured in Intents Studio applies; otherwise we use 1Click directly and
 * attach `appFees` when a NEAR fee account is configured.
 */
const ONECLICK_BASE = process.env.ONECLICK_BASE_URL || 'https://1click.chaindefuser.com/v0'
const AURORA_BASE = process.env.AURORA_INTENTS_BASE_URL || 'https://intents-api.aurora.dev/api'

export const INTEGRATOR_FEE_BPS = Number(process.env.INTENTS_FEE_BPS || 50)

export interface IntentsToken {
  assetId: string
  symbol: string
  blockchain: string
  decimals: number
  price?: number
  priceUpdatedAt?: string
  contractAddress?: string
}

export interface QuoteRequest {
  originAsset: string
  destinationAsset: string
  amount: string // smallest units of origin asset
  recipient: string
  refundTo: string
  dry?: boolean
  slippageTolerance?: number // bps
  deadlineMinutes?: number
  referral?: string
}

export interface QuoteResponse {
  timestamp: string
  signature?: string
  quoteRequest: Record<string, unknown>
  quote: {
    depositAddress?: string
    depositMemo?: string
    amountIn: string
    amountInFormatted: string
    amountInUsd?: string
    minAmountIn?: string
    amountOut: string
    amountOutFormatted: string
    amountOutUsd?: string
    minAmountOut?: string
    deadline?: string
    timeWhenInactive?: string
    timeEstimate?: number
    refundFee?: string
  }
}

export type IntentStatus = 'PENDING_DEPOSIT' | 'KNOWN_DEPOSIT_TX' | 'INCOMPLETE_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'REFUNDED' | 'FAILED'

export interface StatusResponse {
  status: IntentStatus
  updatedAt?: string
  quoteResponse?: QuoteResponse
  swapDetails?: {
    intentHashes?: string[]
    nearTxHashes?: string[]
    amountIn?: string
    amountInFormatted?: string
    amountInUsd?: string
    amountOut?: string
    amountOutFormatted?: string
    amountOutUsd?: string
    slippage?: number
    originChainTxHashes?: { hash: string; explorerUrl?: string }[]
    destinationChainTxHashes?: { hash: string; explorerUrl?: string }[]
    refundedAmount?: string
    refundedAmountFormatted?: string
    refundReason?: string
  }
}

function provider(): 'aurora' | 'oneclick' {
  return process.env.AURORA_API_KEY ? 'aurora' : 'oneclick'
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider() === 'oneclick' && process.env.ONECLICK_JWT) h['Authorization'] = `Bearer ${process.env.ONECLICK_JWT}`
  return h
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, { ...init, headers: { ...headers(), ...(init?.headers || {}) }, signal: ctrl.signal, cache: 'no-store' })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = { message: text }
    }
    if (!res.ok) {
      const msg = (json as { message?: string })?.message || `${res.status} ${res.statusText}`
      throw new Error(`Intents API: ${msg}`)
    }
    return json as T
  } finally {
    clearTimeout(t)
  }
}

let tokenCache: { at: number; tokens: IntentsToken[] } | null = null

export async function getTokens(): Promise<IntentsToken[]> {
  if (tokenCache && Date.now() - tokenCache.at < 10 * 60_000) return tokenCache.tokens
  const url = provider() === 'aurora' ? `${AURORA_BASE}/tokens/${process.env.AURORA_API_KEY}` : `${ONECLICK_BASE}/tokens`
  const raw = await call<IntentsToken[] | { tokens: IntentsToken[] }>(url)
  const tokens = Array.isArray(raw) ? raw : raw.tokens
  tokenCache = { at: Date.now(), tokens }
  return tokens
}

export async function getQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const deadline = new Date(Date.now() + (req.deadlineMinutes ?? 30) * 60_000).toISOString()
  const body: Record<string, unknown> = {
    dry: req.dry ?? true,
    swapType: 'EXACT_INPUT',
    slippageTolerance: req.slippageTolerance ?? 100,
    originAsset: req.originAsset,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: req.destinationAsset,
    amount: req.amount,
    refundTo: req.refundTo,
    refundType: 'ORIGIN_CHAIN',
    recipient: req.recipient,
    recipientType: 'DESTINATION_CHAIN',
    deadline,
    quoteWaitingTimeMs: 3000,
  }
  if (req.referral) body.referral = req.referral
  if (provider() === 'oneclick' && process.env.INTENTS_FEE_RECIPIENT) {
    body.appFees = [{ recipient: process.env.INTENTS_FEE_RECIPIENT, fee: INTEGRATOR_FEE_BPS }]
  }
  const url = provider() === 'aurora' ? `${AURORA_BASE}/quote/${process.env.AURORA_API_KEY}` : `${ONECLICK_BASE}/quote`
  return call<QuoteResponse>(url, { method: 'POST', body: JSON.stringify(body) })
}

export async function getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
  const qs = new URLSearchParams({ depositAddress })
  if (depositMemo) qs.set('depositMemo', depositMemo)
  const url = provider() === 'aurora' ? `${AURORA_BASE}/status/${process.env.AURORA_API_KEY}?${qs}` : `${ONECLICK_BASE}/status?${qs}`
  return call<StatusResponse>(url, undefined, 15_000)
}

export async function submitDeposit(depositAddress: string, txHash: string, memo?: string): Promise<unknown> {
  const url = provider() === 'aurora' ? `${AURORA_BASE}/deposit/submit/${process.env.AURORA_API_KEY}` : `${ONECLICK_BASE}/deposit/submit`
  return call(url, { method: 'POST', body: JSON.stringify({ txHash, depositAddress, ...(memo ? { memo } : {}) }) })
}

export function intentsProvider() {
  return provider()
}

/** Solana destination assets on NEAR Intents (mainnet). */
export const SOLANA_DEST_ASSETS = {
  SOL: 'nep141:sol.omft.near',
  USDC: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
} as const

/** Human-friendly chain names + ordering for the picker. */
export const CHAIN_LABELS: Record<string, { label: string; short: string; order: number }> = {
  eth: { label: 'Ethereum', short: 'ETH', order: 1 },
  base: { label: 'Base', short: 'BASE', order: 2 },
  arb: { label: 'Arbitrum', short: 'ARB', order: 3 },
  btc: { label: 'Bitcoin', short: 'BTC', order: 4 },
  sol: { label: 'Solana', short: 'SOL', order: 5 },
  near: { label: 'NEAR', short: 'NEAR', order: 6 },
  ton: { label: 'TON', short: 'TON', order: 7 },
  tron: { label: 'Tron', short: 'TRX', order: 8 },
  pol: { label: 'Polygon', short: 'POL', order: 9 },
  bsc: { label: 'BNB Chain', short: 'BNB', order: 10 },
  op: { label: 'Optimism', short: 'OP', order: 11 },
  avax: { label: 'Avalanche', short: 'AVAX', order: 12 },
  gnosis: { label: 'Gnosis', short: 'GNO', order: 13 },
  bera: { label: 'Berachain', short: 'BERA', order: 14 },
  sui: { label: 'Sui', short: 'SUI', order: 15 },
  aptos: { label: 'Aptos', short: 'APT', order: 16 },
  xrp: { label: 'XRP Ledger', short: 'XRP', order: 17 },
  doge: { label: 'Dogecoin', short: 'DOGE', order: 18 },
  zec: { label: 'Zcash', short: 'ZEC', order: 19 },
  ltc: { label: 'Litecoin', short: 'LTC', order: 20 },
  bch: { label: 'Bitcoin Cash', short: 'BCH', order: 21 },
  stellar: { label: 'Stellar', short: 'XLM', order: 22 },
  cardano: { label: 'Cardano', short: 'ADA', order: 23 },
  starknet: { label: 'Starknet', short: 'STRK', order: 24 },
  monad: { label: 'Monad', short: 'MON', order: 25 },
  aurora: { label: 'Aurora', short: 'AURORA', order: 26 },
  plasma: { label: 'Plasma', short: 'XPL', order: 27 },
  scroll: { label: 'Scroll', short: 'SCR', order: 28 },
  xlayer: { label: 'X Layer', short: 'OKB', order: 29 },
  adi: { label: 'ADI', short: 'ADI', order: 30 },
  aleo: { label: 'Aleo', short: 'ALEO', order: 31 },
}

export function explorerForChain(chain: string, hash: string): string | null {
  const map: Record<string, string> = {
    eth: `https://etherscan.io/tx/${hash}`,
    base: `https://basescan.org/tx/${hash}`,
    arb: `https://arbiscan.io/tx/${hash}`,
    op: `https://optimistic.etherscan.io/tx/${hash}`,
    pol: `https://polygonscan.com/tx/${hash}`,
    bsc: `https://bscscan.com/tx/${hash}`,
    avax: `https://snowtrace.io/tx/${hash}`,
    btc: `https://mempool.space/tx/${hash}`,
    sol: `https://solscan.io/tx/${hash}`,
    near: `https://nearblocks.io/txns/${hash}`,
    ton: `https://tonviewer.com/transaction/${hash}`,
    tron: `https://tronscan.org/#/transaction/${hash}`,
  }
  return map[chain] ?? null
}
