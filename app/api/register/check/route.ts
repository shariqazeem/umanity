import { NextRequest, NextResponse } from 'next/server'
import { isPubkey } from '@/lib/api'
import { findUser, toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

/** GET /api/register/check?address= — kept for backwards compatibility. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!isPubkey(address)) return NextResponse.json({ registered: false, user: null, error: 'Address required' }, { status: 400 })
  try {
    const user = await findUser(address)
    return NextResponse.json({ registered: !!user, user: user ? toPublicUser(user) : null })
  } catch {
    return NextResponse.json({ registered: false, user: null })
  }
}
