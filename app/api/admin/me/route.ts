import { NextRequest } from 'next/server'
import { ok, isPubkey } from '@/lib/api'
import { isAdminAddress } from '@/lib/admin-auth'

export const runtime = 'nodejs'

/** GET /api/admin/me?address= → whether this wallet may post deliveries. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  return ok({ isAdmin: isPubkey(address) && isAdminAddress(address) })
}
