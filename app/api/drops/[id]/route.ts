import { NextResponse } from 'next/server'
import { getDrop } from '@/lib/umanity/data'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 0) return NextResponse.json({ error: 'Unknown drop' }, { status: 404 })
  try {
    const drop = await getDrop(id)
    if (!drop) return NextResponse.json({ error: 'Unknown drop' }, { status: 404 })
    return NextResponse.json({ drop })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
