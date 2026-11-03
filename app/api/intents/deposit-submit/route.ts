import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { submitDeposit } from '@/lib/intents/oneclick'
import { getIntent, updateIntent } from '@/lib/data/intents'

export const runtime = 'nodejs'

const MAP: Record<string, string> = { PENDING_DEPOSIT: 'pending_deposit', KNOWN_DEPOSIT_TX: 'processing', INCOMPLETE_DEPOSIT: 'incomplete_deposit', PROCESSING: 'processing' }

/** POST /api/intents/deposit-submit { intentId, txHash } — speeds up detection of the origin-chain deposit. */
export async function POST(req: NextRequest) {
  const body = await readJson<{ id?: string; intentId?: string; txHash?: string }>(req)
  const id = body.intentId ?? body.id
  if (!id || !body.txHash) return fail('intentId and txHash required')
  const intent = await getIntent(id)
  if (!intent?.depositAddress) return fail('Intent not found', 404)
  try {
    const r = (await submitDeposit(intent.depositAddress, body.txHash.trim(), intent.depositMemo ?? undefined)) as { status?: string }
    const status = r?.status && MAP[r.status]
    if (status) await updateIntent(id, { status })
    return ok({ result: r })
  } catch (e) {
    return fail(errorMessage(e), 502)
  }
}
