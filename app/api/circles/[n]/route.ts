/**
 * Metadata for one Circle, in the Metaplex JSON standard that wallets and marketplaces read.
 * A Circle that isn't minted yet has no metadata: its art is revealed to its holder first.
 */
import { NextResponse } from 'next/server'
import { CIRCLES_LIMIT, circleName, circleRecords, getCircle } from '@/lib/umanity/circles'

export const dynamic = 'force-dynamic'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'

export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n)
  if (!Number.isInteger(n) || n < 1 || n > CIRCLES_LIMIT) return NextResponse.json({ error: 'No such Circle' }, { status: 404 })
  const c = await getCircle(n)
  if (!c || c.status !== 'minted') return NextResponse.json({ error: 'Not revealed yet' }, { status: 404 })
  const rec = (await circleRecords([c])).get(n)!
  // The picture changes when its giver gives again (a new notch) and when the first film rolls (it closes),
  // so its address carries both, and marketplaces fetch the new one on their next refresh.
  const image = `${APP}/api/circles/${n}/image?v=${rec.gifts}${rec.state === 'open' ? 'o' : 'c'}`
  const given = rec.at.slice(0, 16).replace('T', ' ')
  return NextResponse.json(
    {
      name: circleName(n),
      symbol: 'CIRCLE',
      description: `Circle No. ${String(n).padStart(3, '0')} of The Hundred, drawn by its own gift: the cut turns to the hour it was given (UTC), tally strokes count its number, and each notch is a gift its giver has made. Umanity holds every gift in the open until the delivery is filmed. This Circle stays open and locked until the first filmed delivery; that day every Circle closes and takes the colour of the first film. After that it can be kept or passed on, and 5% of every resale goes to the giving fund. A record, not an investment: no token rights, no airdrop and no promise of value.`,
      image,
      external_url: `${APP}/circles?n=${n}`,
      attributes: [
        { trait_type: 'Season', value: '0 · The Hundred' },
        { trait_type: 'Number', value: n },
        { trait_type: 'Given (UTC)', value: given },
        { trait_type: 'Gifts', value: rec.gifts },
        { trait_type: 'State', value: rec.state === 'open' ? 'Open' : 'Closed' },
      ],
      properties: { category: 'image', files: [{ uri: image, type: 'image/png' }] },
    },
    { headers: { 'cache-control': 'public, max-age=300' } }
  )
}
