import { NextRequest } from 'next/server'
import { ok, isPubkey } from '@/lib/api'
import { getCertificates } from '@/lib/data/donations'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || req.nextUrl.searchParams.get('walletAddress')
  if (!isPubkey(address)) return ok({ nfts: [] })
  return ok({ nfts: await getCertificates(address) })
}
