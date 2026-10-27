/**
 * MultiHopper self-service API client (TRM-screened multi-hop routing on Solana).
 *
 * Flow: estimate → create → prepare (server returns unsigned txs) → user signs
 * and broadcasts → confirm-broadcast → poll. Devnet (`mh_test_` keys) for the
 * product feature; mainnet keys for qualifying volume.
 */
const DEVNET_BASE = 'https://devnet.multihopper.com/api/v1'
const MAINNET_BASE = 'https://multihopper.com/api/v1'

export function multihopperConfigured() {
  return !!process.env.MULTIHOPPER_API_KEY
}

function base() {
  const key = process.env.MULTIHOPPER_API_KEY || ''
  if (process.env.MULTIHOPPER_BASE_URL) return process.env.MULTIHOPPER_BASE_URL
  return key.startsWith('mh_live_') ? MAINNET_BASE : DEVNET_BASE
}

export interface MHError {
  code: string
  message: string
  requestId?: string
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.MULTIHOPPER_API_KEY
  if (!key) throw new Error('MultiHopper is not configured (MULTIHOPPER_API_KEY)')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': key }
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const res = await fetch(`${base()}${path}`, { ...init, headers, signal: ctrl.signal, cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as { error?: MHError } & T
    if (!res.ok) {
      const err = json?.error
      throw new Error(err ? `MultiHopper ${err.code}: ${err.message}` : `MultiHopper HTTP ${res.status}`)
    }
    return json
  } finally {
    clearTimeout(t)
  }
}

export const WSOL_MINT = 'So11111111111111111111111111111111111111112'

export interface EstimateInput {
  amountLamports: number
  hops?: number
  destinationCount?: number
  arrivalSeconds?: number
}

export async function estimate(input: EstimateInput) {
  return call<Record<string, unknown>>('/transfers/estimate', {
    method: 'POST',
    body: JSON.stringify({ tokenMint: WSOL_MINT, amountRaw: String(input.amountLamports), tokenDecimals: 9, hops: input.hops ?? 3, destinationCount: input.destinationCount, arrivalSeconds: input.arrivalSeconds ?? 600 }),
  })
}

export interface CreateInput {
  sourceOwner: string
  amountLamports: number
  recipientWallet?: string
  destinations?: { wallet: string; amountRaw: string }[]
  hops?: number
  arrivalSeconds?: number
  externalId: string
}

export async function createTransfer(input: CreateInput) {
  const body: Record<string, unknown> = {
    tokenMint: WSOL_MINT,
    tokenDecimals: 9,
    tokenSymbol: 'SOL',
    amountRaw: String(input.amountLamports),
    amountTokens: (input.amountLamports / 1e9).toString(),
    sourceOwner: input.sourceOwner,
    hops: input.hops ?? 3,
    arrivalSeconds: input.arrivalSeconds ?? 600,
    externalId: input.externalId,
  }
  if (input.destinations?.length) body.destinations = input.destinations
  else body.recipientWallet = input.recipientWallet
  return call<Record<string, unknown> & { id?: string; transferId?: string }>('/transfers', { method: 'POST', body: JSON.stringify(body), idempotencyKey: input.externalId })
}

export async function prepareTransfer(id: string, idempotencyKey: string) {
  return call<Record<string, unknown>>(`/transfers/${id}/prepare`, { method: 'POST', body: '{}', idempotencyKey })
}

export async function confirmBroadcast(id: string, signatures: Record<string, unknown>, idempotencyKey: string) {
  return call<Record<string, unknown>>(`/transfers/${id}/confirm-broadcast`, { method: 'POST', body: JSON.stringify(signatures), idempotencyKey })
}

export async function getTransfer(id: string) {
  return call<Record<string, unknown>>(`/transfers/${id}`)
}

/** Fee preview used by the UI even when the API key is not configured. */
export function previewFees(amountLamports: number, hops = 3) {
  const percentFee = Math.round(amountLamports * 0.005)
  return {
    hops,
    percentFeeBps: 50,
    percentFeeLamports: percentFee,
    integratorShareLamports: Math.round(percentFee / 2),
    screeningFeeLamportsPerWallet: 2_000_000,
    estimatedArrivalSeconds: 600,
    note: 'TRM-screened route. Umanity keeps 50% of the percentage fee as integrator.',
  }
}
