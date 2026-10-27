import { NextRequest } from 'next/server'
import { ok, fail, readJson } from '@/lib/api'
import { getMilestone, setMilestoneEvidence } from '@/lib/data/governance'
import type { MilestoneEvidence } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = await getMilestone(id)
  if (!m) return fail('Milestone not found', 404)
  return ok({ milestone: m })
}

/**
 * POST /api/milestones/[id]/evidence { summary, items[], submittedBy }
 * The charity / field team uploads delivery evidence that the AI Impact Oracle audits.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<Partial<MilestoneEvidence>>(req)
  if (!body.summary || !Array.isArray(body.items)) return fail('summary and items[] required')
  const m = await getMilestone(id)
  if (!m) return fail('Milestone not found', 404)
  const evidence: MilestoneEvidence = {
    summary: String(body.summary).slice(0, 2000),
    items: body.items.slice(0, 20).map((i) => ({ kind: i.kind, url: i.url, sha256: i.sha256, note: i.note?.slice(0, 500), lat: i.lat, lng: i.lng })),
    submittedBy: body.submittedBy,
    submittedAt: new Date().toISOString(),
  }
  await setMilestoneEvidence(id, evidence)
  return ok({ evidence })
}
