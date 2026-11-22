/** Metadata for the Circles collection itself (the collection's uri on-chain). */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'

export function GET() {
  return NextResponse.json({
    name: 'The Hundred',
    symbol: 'CIRCLE',
    description: 'Season 0 of Umanity. One hundred Circles, one for each of the first hundred people who gave, where every gift waits until the delivery is filmed. Locked until the first filmed drop pays out; after that, part of every resale goes to the giving fund.',
    image: `${APP}/circles-cover.jpg`,
    external_url: `${APP}/circles`,
  })
}
