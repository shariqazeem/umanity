import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { getDare, getDareStakes } from '@/lib/data/dares'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dare = await getDare(id)
  if (!dare) return fail('Dare not found', 404)
  return ok({ dare, stakes: await getDareStakes(id) })
}
