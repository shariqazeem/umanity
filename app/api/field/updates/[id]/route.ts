import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { getFieldUpdate } from '@/lib/data/field'

export const runtime = 'nodejs'

/** GET /api/field/updates/[id] → { update: FieldUpdateView } */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const update = await getFieldUpdate(id)
  if (!update) return fail('Delivery not found', 404)
  return ok({ update })
}
