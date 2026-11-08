/**
 * GET /api/keeper — the daily cron (vercel.json). Runs the same steps page
 * reads trigger: split the fee inbox, claim $UMANITY fees, refund drops that
 * missed their date, and settle cross-chain gifts. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/chain'
import { keepFeesMoving } from '@/lib/umanity/keeper'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, feeSignature: await keepFeesMoving(getConnection()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
