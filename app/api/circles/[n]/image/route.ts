/** A Circle's artwork, decrypted and served only once that Circle is minted. ?size=thumb for 360px. */
import { NextResponse } from 'next/server'
import { CIRCLES_LIMIT, circleArt, getCircle } from '@/lib/umanity/circles'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n)
  if (!Number.isInteger(n) || n < 1 || n > CIRCLES_LIMIT) return NextResponse.json({ error: 'No such Circle' }, { status: 404 })
  const c = await getCircle(n)
  if (!c || c.status !== 'minted') return NextResponse.json({ error: 'Not revealed yet' }, { status: 404 })
  const thumb = new URL(req.url).searchParams.get('size') === 'thumb'
  const art = await circleArt(n, thumb ? 'thumb' : 'full')
  if (!art) return NextResponse.json({ error: 'Art not available' }, { status: 404 })
  return new NextResponse(new Uint8Array(art), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } })
}
