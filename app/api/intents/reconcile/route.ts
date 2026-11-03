import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { getOpenIntents } from '@/lib/data/intents'
import { refreshIntent, OPEN_STATES } from '@/lib/intents/settle'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/intents/reconcile — sweeps open cross-chain gifts so they are
 * credited even when the donor closed the tab. Run from a cron every minute
 * or two (Vercel cron / crontab: curl -H "authorization: Bearer $CRON_SECRET").
 * Spaced out to stay inside the 2,000 requests/hour status budget.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return fail('Unauthorized', 401)
  const open = await getOpenIntents(OPEN_STATES, 25)
  const results: { id: string; status: string; credited?: boolean; error?: string }[] = []
  for (const i of open) {
    // Quotes that were never funded expire after their deadline; stop polling them after a day.
    if (Date.now() - i.createdAt.getTime() > 24 * 3600_000 && i.status === 'pending_deposit') continue
    const r = await refreshIntent(i.id)
    if (r) results.push({ id: i.id, status: r.intent.status, credited: !!r.credited, error: r.error })
    await new Promise((res) => setTimeout(res, 250))
  }
  return ok({ checked: results.length, results })
}
