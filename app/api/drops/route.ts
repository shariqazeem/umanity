import { NextResponse } from 'next/server'
import { listDrops } from '@/lib/umanity/data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ drops: await listDrops() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
