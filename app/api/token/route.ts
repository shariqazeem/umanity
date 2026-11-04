import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/chain'
import { tokenSummary } from '@/lib/umanity/token'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ token: await tokenSummary(getConnection()) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
