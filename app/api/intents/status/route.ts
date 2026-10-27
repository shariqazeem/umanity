import { NextRequest } from 'next/server'
import { ok, fail, errorMessage } from '@/lib/api'
import { getStatus, explorerForChain } from '@/lib/intents/oneclick'
import { getIntent, updateIntent } from '@/lib/data/intents'
import { recordDonation } from '@/lib/data/donations'
import { ensureUser } from '@/lib/data/users'
import { INTENTS_EXPLORER } from '@/lib/intents/config'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

const STATUS_MAP: Record<string, string> = {
  PENDING_DEPOSIT: 'pending_deposit',
  KNOWN_DEPOSIT_TX: 'processing',
  INCOMPLETE_DEPOSIT: 'pending_deposit',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  REFUNDED: 'refunded',
  FAILED: 'failed',
}

/** GET /api/intents/status?id= — polls NEAR Intents and credits the cause on SUCCESS (once). */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return fail('id required')
  const intent = await getIntent(id)
  if (!intent) return fail('Intent not found', 404)
  if (!intent.depositAddress) return ok({ intent })
  if (intent.status === 'success' || intent.status === 'refunded' || intent.status === 'failed') {
    return ok({ intent, explorer: `${INTENTS_EXPLORER}/?search=${intent.depositAddress}` })
  }
  try {
    const s = await getStatus(intent.depositAddress, intent.depositMemo ?? undefined)
    const mapped = STATUS_MAP[s.status] ?? intent.status
    const dest = s.swapDetails?.destinationChainTxHashes?.[0]
    const patch: Parameters<typeof updateIntent>[1] = { status: mapped, lastStatusPayload: s as unknown as Record<string, unknown> }
    if (dest?.hash) {
      patch.settlementSignature = dest.hash
      patch.explorerUrl = dest.explorerUrl || explorerForChain('sol', dest.hash) || null
    }
    if (s.swapDetails?.amountOut) {
      // amountOut is in destination smallest units (lamports for SOL, 1e6 for USDC)
      patch.amountOutLamports = intent.destAsset === 'SOL' ? Number(s.swapDetails.amountOut) : Math.round((Number(s.swapDetails.amountOut) / 1e6) * LAMPORTS_PER_SOL)
    }
    const updated = await updateIntent(id, patch)
    if (mapped === 'success' && intent.status !== 'success' && updated?.poolId) {
      const donor = updated.userAddress ?? updated.depositAddress!
      if (updated.userAddress) await ensureUser(updated.userAddress)
      await recordDonation({
        donorAddress: donor,
        poolId: updated.poolId,
        amountLamports: updated.amountOutLamports ?? 0,
        signature: dest?.hash || `intent_${id}`,
        route: 'intents',
        sourceChain: updated.sourceChain,
        sourceAsset: updated.sourceAsset,
        sourceAmount: updated.sourceAmount ?? undefined,
        intentId: id,
        silent: !updated.userAddress,
      }).catch((e) => console.error('credit intent donation', e))
    }
    return ok({ intent: updated, raw: s, explorer: `${INTENTS_EXPLORER}/?search=${intent.depositAddress}` })
  } catch (e) {
    return ok({ intent, error: errorMessage(e), explorer: `${INTENTS_EXPLORER}/?search=${intent.depositAddress}` })
  }
}
