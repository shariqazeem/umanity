/**
 * The team's drop actions (admin wallet signature required, see lib/admin-auth.ts):
 *   POST { action: 'create', meta, goalUsd, capUsd, deadline, payee }
 *   POST { action: 'update' | 'proof', dropId, title, body, media, xPostUrl? }
 *   POST { action: 'unlock' | 'cancel' | 'refund', dropId }
 *   POST { action: 'check', dropId }   (the NEAR guard's AI check of the current proof; runs by itself after 'proof')
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getConnection } from '@/lib/solana/chain'
import type { MediaItem } from '@/lib/db/schema'
import type { DropMeta } from '@/lib/umanity/drops'
import { cancelDrop, createDrop, postProof, postUpdate, refundBackers, unlockDrop } from '@/lib/umanity/admin'
import { guardEnabled } from '@/lib/near/config'
import { checkDropProof } from '@/lib/near/flow'
import { syncChain } from '@/lib/umanity/indexer'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
  let out: unknown
  try {
    switch (b.action) {
      case 'create': {
        const deadline = new Date(String(b.deadline))
        if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now() + 3600_000) return bad('The date must be at least an hour away')
        out = await createDrop(conn, { meta: b.meta as DropMeta, goalUsd: Number(b.goalUsd), capUsd: Number(b.capUsd), deadline, payee: String(b.payee) })
        break
      }
      case 'update':
      case 'proof': {
        const post = { dropId, title: String(b.title ?? '').trim().slice(0, 120), body: String(b.body ?? '').trim().slice(0, 4000), media: media(b.media), xPostUrl: typeof b.xPostUrl === 'string' && /^https:\/\/(x|twitter)\.com\//.test(b.xPostUrl) ? b.xPostUrl : null, postedBy: auth.address! }
        if (!Number.isInteger(dropId) || !post.title) return bad('A drop and a title are required')
        out = b.action === 'proof' ? await postProof(conn, post) : await postUpdate(post)
        // The guard's AI check starts as soon as the proof is on-chain; the verdict lands in about a minute.
        if (b.action === 'proof' && guardEnabled()) after(() => checkDropProof(conn, dropId).then(() => undefined, (e) => console.warn('[guard] proof check failed:', (e as Error).message)))
        break
      }
      case 'check':
        out = await checkDropProof(conn, dropId)
        break
      case 'unlock':
        out = { signature: await unlockDrop(conn, dropId) }
        break
      case 'cancel':
        out = { signature: await cancelDrop(conn, dropId) }
        break
      case 'refund':
        out = await refundBackers(conn, dropId, 30)
        break
      default:
        return bad('Unknown action')
    }
  } catch (e) {
    return bad((e as Error).message, 500)
  }
  // The console reloads right after this: mirror the chain first so it shows the new state.
  await syncChain(conn).catch((e) => console.warn('[admin] sync after action failed:', (e as Error).message))
  return NextResponse.json(out)
}
