import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { submitDeposit } from '@/lib/intents/oneclick'
import { getIntent, updateIntent } from '@/lib/data/intents'

export const runtime = 'nodejs'

/** POST /api/intents/deposit-submit { id, txHash } — speeds up detection of the origin-chain deposit. */
export async function POST(req: NextRequest) {
  const body = await readJson<{ id?: string; txHash?: string }>(req)
  if (!body.id || !body.txHash) return fail('id and txHash required')
  const intent = await getIntent(body.id)
  if (!intent?.depositAddress) return fail('Intent not found', 404)
  try {
    const r = await submitDeposit(intent.depositAddress, body.txHash, intent.depositMemo ?? undefined)
    await updateIntent(body.id, { status: 'processing' })
    return ok({ result: r })
  } catch (e) {
    return fail(errorMessage(e), 502)
  }
}
