/**
 * Metadata for one Circle, in the Metaplex JSON standard that wallets and marketplaces read.
 * A Circle that isn't minted yet has no metadata: its art is revealed to its holder first.
 */
import { NextResponse } from 'next/server'
import { CIRCLES_LIMIT, circleName, circleScene, getCircle } from '@/lib/umanity/circles'

export const dynamic = 'force-dynamic'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'
const SCENE: Record<string, string> = { pedestal: 'Pedestal', halo: 'Halo', pot: 'The pot', step: 'The step', coin: 'Heart coin', door: 'The door' }

export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n)
  if (!Number.isInteger(n) || n < 1 || n > CIRCLES_LIMIT) return NextResponse.json({ error: 'No such Circle' }, { status: 404 })
  const c = await getCircle(n)
  if (!c || c.status !== 'minted') return NextResponse.json({ error: 'Not revealed yet' }, { status: 404 })
  const image = `${APP}/api/circles/${n}/image`
  return NextResponse.json(
    {
      name: circleName(n),
      symbol: 'CIRCLE',
      description: `One of the hundred. Circle No. ${String(n).padStart(3, '0')} belongs to one of the first hundred people who gave to Umanity, where every gift waits until the delivery is filmed. It stays locked until the first filmed drop pays out. Then it is yours to keep or pass on, and part of every resale goes to the giving fund.`,
      image,
      external_url: `${APP}/circles?n=${n}`,
      attributes: [
        { trait_type: 'Season', value: '0 · The Hundred' },
        { trait_type: 'Number', value: n },
        { trait_type: 'Scene', value: SCENE[circleScene(n)] ?? 'Circle' },
      ],
      properties: { category: 'image', files: [{ uri: image, type: 'image/jpeg' }] },
    },
    { headers: { 'cache-control': 'public, max-age=300' } }
  )
}
