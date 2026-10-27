import { NextRequest, NextResponse } from 'next/server'
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getCause } from '@/lib/causes'
import { buildDonateIx } from '@/lib/solana/instructions'
import { getConnection } from '@/lib/solana/chain'
import { CAIP2_CURRENT } from '@/lib/solana/constants'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Encoding',
  'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids',
  'X-Action-Version': '2.1.3',
  'X-Blockchain-Ids': CAIP2_CURRENT,
  'Content-Type': 'application/json',
}

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const cause = getCause(poolId)
  if (!cause) return NextResponse.json({ error: 'Pool not found' }, { status: 404, headers: CORS_HEADERS })
  const base = baseUrl(req)
  return NextResponse.json(
    {
      type: 'action',
      title: `${cause.emoji} Donate to ${cause.name}`,
      icon: `${base}/logo.png`,
      description: `${cause.description}. Funds are escrowed on-chain and released by community vote.`,
      label: 'Donate SOL',
      links: {
        actions: [
          { type: 'transaction', label: '0.01 SOL', href: `${base}/api/actions/donate/${poolId}?amount=0.01` },
          { type: 'transaction', label: '0.05 SOL', href: `${base}/api/actions/donate/${poolId}?amount=0.05` },
          { type: 'transaction', label: '0.1 SOL', href: `${base}/api/actions/donate/${poolId}?amount=0.1` },
          { type: 'transaction', label: 'Custom', href: `${base}/api/actions/donate/${poolId}?amount={amount}`, parameters: [{ name: 'amount', label: 'SOL amount', required: true }] },
        ],
      },
    },
    { headers: CORS_HEADERS }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ poolId: string }> }) {
  try {
    const { poolId } = await params
    if (!getCause(poolId)) return NextResponse.json({ error: 'Pool not found' }, { status: 404, headers: CORS_HEADERS })
    const body = await req.json()
    const donor = new PublicKey(body.account)
    const amount = parseFloat(req.nextUrl.searchParams.get('amount') || '0.01')
    if (!(amount > 0) || amount > 100) return NextResponse.json({ error: 'Invalid amount' }, { status: 400, headers: CORS_HEADERS })
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL)
    const conn = getConnection()
    const { ix } = await buildDonateIx(conn, poolId, donor, lamports)
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
    const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: donor }).add(ix)
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    return NextResponse.json({ type: 'transaction', transaction: serialized.toString('base64'), message: `Donating ${amount} SOL to ${getCause(poolId)!.name} via Umanity escrow` }, { headers: CORS_HEADERS })
  } catch (e) {
    console.error('Blink POST error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to build transaction' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS })
}
