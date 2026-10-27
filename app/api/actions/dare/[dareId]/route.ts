import { NextRequest, NextResponse } from 'next/server'
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getDare } from '@/lib/data/dares'
import { buildBoostDareIx } from '@/lib/solana/instructions'
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

/** Solana Action: co-stake ("boost the pot") on a live Impact Dare straight from X. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dareId: string }> }) {
  const { dareId } = await params
  const dare = await getDare(dareId)
  if (!dare) return NextResponse.json({ error: 'Dare not found' }, { status: 404, headers: CORS_HEADERS })
  const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const open = dare.status === 'open' && dare.secondsLeft > 0
  return NextResponse.json(
    {
      type: 'action',
      title: `⚡ Dare for @${dare.targetHandle}: ${dare.text}`,
      icon: `${base}/logo.png`,
      description: `Pot ${dare.pot.toFixed(3)} SOL from ${dare.backerCount} backers for ${dare.poolEmoji} ${dare.poolName}. ${open ? `${Math.floor(dare.secondsLeft / 3600)}h left.` : 'Closed.'} Whatever happens, the pot goes to the cause.`,
      label: 'Boost the pot',
      disabled: !open,
      links: {
        actions: [
          { type: 'transaction', label: '+0.05 SOL', href: `${base}/api/actions/dare/${dareId}?amount=0.05` },
          { type: 'transaction', label: '+0.1 SOL', href: `${base}/api/actions/dare/${dareId}?amount=0.1` },
          { type: 'transaction', label: '+0.5 SOL', href: `${base}/api/actions/dare/${dareId}?amount=0.5` },
          { type: 'transaction', label: 'Custom', href: `${base}/api/actions/dare/${dareId}?amount={amount}`, parameters: [{ name: 'amount', label: 'SOL amount', required: true }] },
        ],
      },
    },
    { headers: CORS_HEADERS }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ dareId: string }> }) {
  try {
    const { dareId } = await params
    const dare = await getDare(dareId)
    if (!dare || !dare.darePda) return NextResponse.json({ error: 'Dare not found' }, { status: 404, headers: CORS_HEADERS })
    const body = await req.json()
    const backer = new PublicKey(body.account)
    const amount = parseFloat(req.nextUrl.searchParams.get('amount') || '0.05')
    if (!(amount > 0) || amount > 100) return NextResponse.json({ error: 'Invalid amount' }, { status: 400, headers: CORS_HEADERS })
    const ix = await buildBoostDareIx(new PublicKey(dare.darePda), backer, Math.floor(amount * LAMPORTS_PER_SOL))
    const conn = getConnection()
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
    const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: backer }).add(ix)
    return NextResponse.json({ type: 'transaction', transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), message: `Boosting the dare pot by ${amount} SOL for ${dare.poolName}` }, { headers: CORS_HEADERS })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS })
}
