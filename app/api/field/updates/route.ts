import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage } from '@/lib/api'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { createFieldUpdate, getFieldUpdates, type CreateFieldUpdateInput } from '@/lib/data/field'
import { getCause } from '@/lib/causes'
import type { MediaItem } from '@/lib/db'

export const runtime = 'nodejs'

/** GET /api/field/updates?poolId=&limit= → { updates: FieldUpdateView[] } */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const limit = Math.min(100, Number(q.get('limit') || 20))
  const poolId = q.get('poolId') || undefined
  return ok({ updates: await getFieldUpdates({ poolId, limit }) })
}

const KINDS: MediaItem['kind'][] = ['photo', 'video', 'receipt', 'document']

/**
 * POST /api/field/updates (admin) — the field team posts a delivery with its proof.
 * Body: { poolId, title, description, amountSol?, fiatAmount?, location?, deliveredAt?, media: MediaItem[], milestoneIndex?, requestRelease?, xPostUrl? }
 */
export async function POST(req: NextRequest) {
  const auth = verifyAdminRequest(req)
  if (!auth.ok || !auth.address) return fail(auth.error || 'Unauthorized', 401)
  const body = await readJson<Partial<CreateFieldUpdateInput>>(req)
  if (!body.poolId || !getCause(body.poolId)) return fail('poolId must be an existing cause')
  if (!body.title?.trim() || !body.description?.trim()) return fail('title and description are required')
  const media: MediaItem[] = Array.isArray(body.media)
    ? body.media
        .filter((m) => m && typeof m.url === 'string' && m.url.length < 600)
        .map((m) => ({ url: m.url, kind: KINDS.includes(m.kind) ? m.kind : 'photo', sha256: m.sha256, note: m.note?.slice(0, 300), lat: typeof m.lat === 'number' ? m.lat : undefined, lng: typeof m.lng === 'number' ? m.lng : undefined }))
    : []
  try {
    const update = await createFieldUpdate(
      {
        poolId: body.poolId,
        title: body.title.trim(),
        description: body.description.trim(),
        amountSol: typeof body.amountSol === 'number' ? body.amountSol : Number(body.amountSol) || 0,
        fiatAmount: body.fiatAmount,
        location: body.location,
        deliveredAt: body.deliveredAt,
        media,
        milestoneIndex: typeof body.milestoneIndex === 'number' ? body.milestoneIndex : undefined,
        requestRelease: !!body.requestRelease,
        xPostUrl: body.xPostUrl,
      },
      auth.address
    )
    return ok({ update })
  } catch (e) {
    return fail(errorMessage(e), 400)
  }
}
