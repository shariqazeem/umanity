import { NextRequest, NextResponse } from 'next/server'
import { homeFeed } from '@/lib/umanity/feed'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams
    return NextResponse.json({ items: await homeFeed({ viewer: q.get('address'), limit: Number(q.get('limit')) || undefined }) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
