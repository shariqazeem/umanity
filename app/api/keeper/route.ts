/**
 * GET /api/keeper — the daily cron (vercel.json). Runs the same steps page
 * reads trigger: split the fee inbox, claim $UMANITY fees, refund drops that
 * missed their date, settle cross-chain gifts, and move guarded drops along
 * (AI check of new proofs, release of approved ones). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/chain'
import { keepFeesMoving } from '@/lib/umanity/keeper'
import { keepGuardMoving } from '@/lib/near/flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const conn = getConnection()
    const feeSignature = await keepFeesMoving(conn)
    const guard = await keepGuardMoving(conn).catch((e) => ({ error: (e as Error).message }))
    return NextResponse.json({ ok: true, feeSignature, guard })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
