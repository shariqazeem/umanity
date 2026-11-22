/** Metadata for the Circles collection itself (the collection's uri on-chain). */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'

export function GET() {
  return NextResponse.json({
    name: 'The Hundred',
    symbol: 'CIRCLE',
    description: 'Season 0 of Umanity: the hundred who gave before there was anything to see. One Circle for each, in the order they gave, where every gift waits until the delivery is filmed. The season closes and every Circle unlocks when the first filmed drop pays out; after that, 5% of every resale goes to the giving fund. Keepsakes and records: no token rights, no airdrop, no promise of value.',
    image: `${APP}/circles-cover.jpg`,
    external_url: `${APP}/circles`,
  })
}
