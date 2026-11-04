import { NextRequest, NextResponse } from 'next/server'
import { isPubkey } from '@/lib/api'
import { backerProfile } from '@/lib/umanity/profile'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!isPubkey(address)) return NextResponse.json({ error: 'address is required' }, { status: 400 })
  try {
    return NextResponse.json(await backerProfile(address!))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
