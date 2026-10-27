import { NextRequest } from 'next/server'
import { ok, fail, readJson, isPubkey, errorMessage } from '@/lib/api'
import { multihopperConfigured, estimate, createTransfer, prepareTransfer, confirmBroadcast, getTransfer, previewFees } from '@/lib/multihopper/client'
import { createRoutedTransfer, updateRoutedTransfer, getRoutedTransfer } from '@/lib/data/intents'
import { getPool } from '@/lib/data/donations'
import { getCause } from '@/lib/causes'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'

export const runtime = 'nodejs'

/**
 * Discreet route (MultiHopper) lifecycle in one endpoint:
 *   { action: 'estimate', amount, hops }                 → fee preview (works without a key)
 *   { action: 'create', amount, hops, poolId, source }   → route created, returns unsigned txs to sign
 *   { action: 'confirm', id, signatures }                → after the user broadcasts
 *   { action: 'status', id }                             → poll
 * Destination for a discreet donation is the cause's escrow vault PDA.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ action?: string; amount?: number; hops?: number; poolId?: string; source?: string; id?: string; signatures?: Record<string, unknown> }>(req)
  const lamports = Math.round(Number(body.amount || 0) * LAMPORTS_PER_SOL)
  try {
    switch (body.action) {
      case 'estimate': {
        if (!(lamports > 0)) return fail('amount required')
        const preview = previewFees(lamports, body.hops ?? 3)
        if (!multihopperConfigured()) return ok({ configured: false, preview })
        const est = await estimate({ amountLamports: lamports, hops: body.hops ?? 3 })
        return ok({ configured: true, preview, estimate: est })
      }
      case 'create': {
        if (!multihopperConfigured()) return fail('MultiHopper key not configured on this server', 503)
        if (!(lamports > 0) || !body.poolId || !getCause(body.poolId) || !isPubkey(body.source)) return fail('amount, poolId and source wallet required')
        const pool = await getPool(body.poolId)
        if (!pool) return fail('Pool not found', 404)
        const row = await createRoutedTransfer({ kind: 'discreet_donation', userAddress: body.source, poolId: body.poolId, amountLamports: lamports, hops: body.hops ?? 3, status: 'creating' })
        const created = await createTransfer({ sourceOwner: body.source!, amountLamports: lamports, recipientWallet: pool.vaultPda, hops: body.hops ?? 3, externalId: row.id })
        const providerId = String(created.id || created.transferId || '')
        const prepared = await prepareTransfer(providerId, `${row.id}-prepare`)
        await updateRoutedTransfer(row.id, { providerRef: providerId, status: 'awaiting_signature', payload: { created, prepared } })
        return ok({ id: row.id, providerId, created, prepared })
      }
      case 'confirm': {
        if (!body.id) return fail('id required')
        const row = await getRoutedTransfer(body.id)
        if (!row?.providerRef) return fail('Transfer not found', 404)
        const r = await confirmBroadcast(row.providerRef, body.signatures ?? {}, `${row.id}-confirm-${Date.now()}`)
        await updateRoutedTransfer(row.id, { status: 'processing' })
        return ok({ result: r })
      }
      case 'status': {
        if (!body.id) return fail('id required')
        const row = await getRoutedTransfer(body.id)
        if (!row) return fail('Transfer not found', 404)
        if (!row.providerRef) return ok({ transfer: row })
        const s = await getTransfer(row.providerRef)
        const status = String((s as { status?: string }).status || row.status)
        await updateRoutedTransfer(row.id, { status, payload: { ...(row.payload ?? {}), last: s } })
        return ok({ transfer: { ...row, status }, raw: s })
      }
      default:
        return fail('Unknown action')
    }
  } catch (e) {
    return fail(errorMessage(e), 502)
  }
}
