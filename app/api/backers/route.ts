import { NextResponse } from 'next/server'
import { topBackers } from '@/lib/umanity/feed'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ backers: await topBackers(5) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
