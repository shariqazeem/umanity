/**
 * The team's drop actions (admin wallet signature required, see lib/admin-auth.ts):
 *   POST { action: 'create', meta, goalUsd, capUsd, deadline, payee }
 *   POST { action: 'update' | 'proof', dropId, title, body, media, xPostUrl? }
 *   POST { action: 'unlock' | 'cancel' | 'refund', dropId }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getConnection } from '@/lib/solana/chain'
import type { MediaItem } from '@/lib/db/schema'
import type { DropMeta } from '@/lib/umanity/drops'
import { cancelDrop, createDrop, postProof, postUpdate, refundBackers, unlockDrop } from '@/lib/umanity/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

function media(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is MediaItem => !!m && typeof m === 'object' && typeof (m as MediaItem).url === 'string')
    .map((m) => ({ url: m.url, kind: ['photo', 'video', 'receipt', 'document'].includes(m.kind) ? m.kind : 'photo', sha256: m.sha256, note: typeof m.note === 'string' ? m.note.slice(0, 200) : undefined }))
    .slice(0, 20)
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok) return bad(auth.error || 'Unauthorized', 401)
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const conn = getConnection()
  const dropId = Number(b.dropId)
  try {
    switch (b.action) {
      case 'create': {
        const deadline = new Date(String(b.deadline))
        if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now() + 3600_000) return bad('The date must be at least an hour away')
        return NextResponse.json(await createDrop(conn, { meta: b.meta as DropMeta, goalUsd: Number(b.goalUsd), capUsd: Number(b.capUsd), deadline, payee: String(b.payee) }))
      }
      case 'update':
      case 'proof': {
        const post = { dropId, title: String(b.title ?? '').trim().slice(0, 120), body: String(b.body ?? '').trim().slice(0, 4000), media: media(b.media), xPostUrl: typeof b.xPostUrl === 'string' && /^https:\/\/(x|twitter)\.com\//.test(b.xPostUrl) ? b.xPostUrl : null, postedBy: auth.address! }
        if (!Number.isInteger(dropId) || !post.title) return bad('A drop and a title are required')
        return NextResponse.json(b.action === 'proof' ? await postProof(conn, post) : await postUpdate(post))
      }
      case 'unlock':
        return NextResponse.json({ signature: await unlockDrop(conn, dropId) })
      case 'cancel':
        return NextResponse.json({ signature: await cancelDrop(conn, dropId) })
      case 'refund':
        return NextResponse.json(await refundBackers(conn, dropId, 30))
      default:
        return bad('Unknown action')
    }
  } catch (e) {
    return bad((e as Error).message, 500)
  }
}
