/**
 * Tracks a cross-chain gift from deposit to escrow. Used by the status route
 * (the donor's browser polls it) and by the reconcile route (a cron sweeps
 * open intents so a gift is credited even if the donor closed the tab).
 *
 * On SUCCESS the solver has paid SOL to the settlement wallet on Solana
 * mainnet. The treasury then deposits that amount into the cause's escrow
 * vault with `donate` + a memo naming the intent, and the gift is credited
 * once (the deposit signature is unique). On a devnet build the deposit goes
 * into the devnet vault and the receipt says so.
 */
import { getStatus, explorerForChain, type StatusResponse } from './oneclick'
import { INTENTS_EXPLORER } from './config'
import { updateIntent, getIntent, claimIntentSuccess } from '@/lib/data/intents'
import { recordDonation } from '@/lib/data/donations'
import { creditGiftToCampaign } from '@/lib/data/governance'
import { ensureUser } from '@/lib/data/users'
import { depositToEscrow } from '@/lib/solana/escrow-forward'
import { getSolUsd } from '@/lib/server/price'
import { IS_MAINNET, LAMPORTS_PER_SOL } from '@/lib/solana/constants'
import type { Intent } from '@/lib/db'

export const OPEN_STATES = ['pending_deposit', 'incomplete_deposit', 'processing', 'failed']

const STATUS_MAP: Record<string, string> = {
  PENDING_DEPOSIT: 'pending_deposit',
  KNOWN_DEPOSIT_TX: 'processing',
  INCOMPLETE_DEPOSIT: 'incomplete_deposit',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  REFUNDED: 'refunded',
  // FAILED is retried by the network, so it is not final for us either.
  FAILED: 'failed',
}

export function intentExplorer(depositAddress: string | null | undefined) {
  return depositAddress ? `${INTENTS_EXPLORER}/transactions/${depositAddress}` : INTENTS_EXPLORER
}

export interface RefreshResult {
  intent: Intent
  raw?: StatusResponse
  credited?: { donationId: string; escrowSignature: string | null; mode: 'forwarded' | 'devnet-mirror' | 'pending' }
  error?: string
}

/** SOL-equivalent lamports for what the solver delivered. */
async function deliveredLamports(intent: Intent, s: StatusResponse): Promise<number> {
  const out = s.swapDetails?.amountOut
  if (!out) return intent.amountOutLamports ?? 0
  if (intent.destAsset === 'SOL') return Number(out)
  // USDC (6 decimals) → SOL equivalent at the current price, for the ledger only.
  const { usd } = await getSolUsd()
  return usd ? Math.floor((Number(out) / 1e6 / usd) * LAMPORTS_PER_SOL) : 0
}

export async function refreshIntent(id: string): Promise<RefreshResult | null> {
  const intent = await getIntent(id)
  if (!intent) return null
  if (!intent.depositAddress || !OPEN_STATES.includes(intent.status)) return { intent }
  let s: StatusResponse
  try {
    s = await getStatus(intent.depositAddress, intent.depositMemo ?? undefined)
  } catch (e) {
    return { intent, error: e instanceof Error ? e.message : String(e) }
  }
  const mapped = STATUS_MAP[s.status] ?? intent.status
  const dest = s.swapDetails?.destinationChainTxHashes?.[0]
  // 'success' is only ever written by claimIntentSuccess, so two pollers cannot both credit it.
  const patch: Parameters<typeof updateIntent>[1] = { ...(mapped === 'success' ? {} : { status: mapped }), lastStatusPayload: s as unknown as Record<string, unknown> }
  if (dest?.hash) {
    patch.settlementSignature = dest.hash
    patch.explorerUrl = dest.explorerUrl || explorerForChain('sol', dest.hash) || null
  }
  if (s.swapDetails?.amountOut) patch.amountOutLamports = await deliveredLamports(intent, s)
  const updated = (await updateIntent(id, patch)) ?? intent

  if (mapped !== 'success' || !updated.poolId) return { intent: updated, raw: s }
  const claimed = await claimIntentSuccess(id)
  if (!claimed) return { intent: updated, raw: s }

  // Settled: move it into escrow, then credit the donor exactly once.
  const lamports = updated.amountOutLamports ?? 0
  let escrowSignature: string | null = null
  try {
    if (lamports > 0) escrowSignature = (await depositToEscrow(updated.poolId, lamports, `umanity:intent:${updated.depositAddress}:${dest?.hash ?? ''}`)).signature
  } catch (e) {
    console.error('intent escrow forward failed', id, e)
  }
  const donor = updated.userAddress ?? updated.depositAddress!
  if (updated.userAddress) await ensureUser(updated.userAddress)
  const r = await recordDonation({
    donorAddress: donor,
    poolId: updated.poolId,
    amountLamports: lamports,
    signature: escrowSignature ?? dest?.hash ?? `intent_${id}`,
    route: 'intents',
    settlementSignature: dest?.hash,
    sourceChain: updated.sourceChain,
    sourceAsset: updated.sourceAsset,
    sourceAmount: updated.sourceAmount ?? undefined,
    intentId: id,
    silent: !updated.userAddress,
  })
  if (r.created && escrowSignature) await creditGiftToCampaign(updated.poolId, lamports, donor).catch((e) => console.error('campaign credit', e))
  await updateIntent(id, { lastStatusPayload: { ...(s as unknown as Record<string, unknown>), umanity: { escrowSignature, mode: escrowSignature ? (IS_MAINNET ? 'forwarded' : 'devnet-mirror') : 'pending' } } })
  return { intent: updated, raw: s, credited: { donationId: r.donation.id, escrowSignature, mode: escrowSignature ? (IS_MAINNET ? 'forwarded' : 'devnet-mirror') : 'pending' } }
}
