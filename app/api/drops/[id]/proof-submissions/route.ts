/**
 * POST /api/drops/[id]/proof-submissions { title, body, xPostUrl?, links[] }
 * A community drop's runner sends their proof, signed by their wallet (the drop's payee).
 * The team checks it and posts it on-chain from /admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { verifyWalletRequest } from '@/lib/admin-auth'
import { getConnection } from '@/lib/solana/chain'
import { submitProof } from '@/lib/umanity/community'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyWalletRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const dropId = Number((await params).id)
  if (!Number.isInteger(dropId) || dropId < 0) return NextResponse.json({ error: 'Unknown drop' }, { status: 404 })
  try {
    const b = (await req.json()) as { title?: string; body?: string; xPostUrl?: string; links?: string[] }
    return NextResponse.json(await submitProof(getConnection(), auth.address!, dropId, { title: String(b.title ?? ''), body: String(b.body ?? ''), xPostUrl: b.xPostUrl ?? null, links: Array.isArray(b.links) ? b.links.map(String) : [] }))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
