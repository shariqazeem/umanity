import { NextRequest } from 'next/server'
import { ok, isPubkey } from '@/lib/api'
import { getIntentsForUser, getRecentIntents } from '@/lib/data/intents'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const rows = isPubkey(address) ? await getIntentsForUser(address, 20) : await getRecentIntents(20)
  return ok({ intents: rows.map((i) => ({ ...i, quote: undefined, lastStatusPayload: undefined })) })
}
