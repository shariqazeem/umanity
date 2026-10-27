import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson } from '@/lib/api'
import { getNotifications, markNotificationsRead, notify } from '@/lib/data/social'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!isPubkey(address)) return ok({ notifications: [], unreadCount: 0 })
  const notifications = await getNotifications(address)
  return ok({ notifications, unreadCount: notifications.filter((n) => !n.read).length })
}

export async function POST(req: NextRequest) {
  const body = await readJson<{ recipientAddress?: string; type?: string; message?: string; fromUsername?: string }>(req)
  if (!isPubkey(body.recipientAddress) || !body.message) return fail('recipientAddress and message required')
  await notify(body.recipientAddress, body.type || 'general', body.message.slice(0, 280), body.fromUsername)
  return ok({})
}

export async function PATCH(req: NextRequest) {
  const body = await readJson<{ address?: string }>(req)
  if (!isPubkey(body.address)) return fail('address required')
  await markNotificationsRead(body.address)
  return ok({})
}
