import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { getGiftJourney } from '@/lib/data/journey'

export const runtime = 'nodejs'

/** GET /api/gifts/[ref]?viewer= — one gift's journey; ref is the gift id, its escrow tx or its payment tx. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const journey = await getGiftJourney(decodeURIComponent(ref), req.nextUrl.searchParams.get('viewer'))
  if (!journey) return fail('Gift not found', 404)
  return ok({ journey })
}
