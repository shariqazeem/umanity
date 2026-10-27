/**
 * Field deliveries: what the Umanity team bought and handed over, with the
 * photos and receipts that prove it. A delivery can attach evidence to a
 * milestone and open the donors' release vote.
 */
import { desc, eq, inArray } from 'drizzle-orm'
import { getDb, newId, fieldDeliveries, milestones, campaigns, type FieldDelivery, type MediaItem, type MilestoneEvidence } from '@/lib/db'
import { getCause } from '@/lib/causes'
import { LAMPORTS_PER_SOL } from '@/lib/solana/constants'
import { getProposals, toMilestoneView, createMilestoneProposal, setMilestoneEvidence, type ProposalView } from './governance'
import { createPost, notifyMany } from './social'
import { ensureUser } from './users'
import { getDonorAddressesForPool } from './donations'
import type { FieldUpdateView } from '@/lib/contracts'

export interface CreateFieldUpdateInput {
  poolId: string
  title: string
  description: string
  amountSol?: number
  fiatAmount?: string
  location?: string
  deliveredAt?: string
  media: MediaItem[]
  milestoneIndex?: number
  requestRelease?: boolean
  xPostUrl?: string
}

const EVIDENCE_KIND: Record<MediaItem['kind'], MilestoneEvidence['items'][number]['kind']> = { photo: 'photo', video: 'video', receipt: 'receipt', document: 'invoice' }

export async function toFieldUpdateViews(rows: FieldDelivery[]): Promise<FieldUpdateView[]> {
  if (!rows.length) return []
  const db = await getDb()
  const msIds = rows.map((r) => r.milestoneId).filter((x): x is string => !!x)
  const ms = msIds.length ? await db.select().from(milestones).where(inArray(milestones.id, msIds)) : []
  const campIds = Array.from(new Set(ms.map((m) => m.campaignId)))
  const cs = campIds.length ? await db.select().from(campaigns).where(inArray(campaigns.id, campIds)) : []
  const propIds = new Set([...rows.map((r) => r.proposalId), ...ms.map((m) => m.proposalId)].filter(Boolean) as string[])
  const props: Map<string, ProposalView> = propIds.size ? new Map((await getProposals()).filter((p) => propIds.has(p.id)).map((p) => [p.id, p])) : new Map()
  return rows.map((r) => {
    const m = r.milestoneId ? ms.find((x) => x.id === r.milestoneId) : undefined
    const c = m ? cs.find((x) => x.id === m.campaignId) : undefined
    const proposal = props.get(r.proposalId || m?.proposalId || '') ?? null
    return {
      id: r.id,
      poolId: r.poolId,
      poolName: getCause(r.poolId)?.name ?? r.poolId,
      milestoneId: r.milestoneId ?? null,
      title: r.title,
      description: r.description,
      amountSol: r.amountLamports / LAMPORTS_PER_SOL,
      fiatAmount: r.fiatAmount ?? null,
      location: r.location ?? null,
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      media: r.media ?? [],
      evidence: r.evidence ?? m?.evidence ?? null,
      attestation: m?.attestation ?? null,
      milestone: m && c ? toMilestoneView(m, c.totalRaisedLamports) : null,
      proposal,
      proofTxSignature: r.proofTxSignature ?? null,
      releaseTxSignature: m?.releaseTxSignature ?? null,
      xPostUrl: r.xPostUrl ?? null,
      createdAt: r.createdAt.toISOString(),
    }
  })
}

export async function getFieldUpdates(filter: { poolId?: string; limit?: number } = {}): Promise<FieldUpdateView[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(fieldDeliveries)
    .where(filter.poolId ? eq(fieldDeliveries.poolId, filter.poolId) : undefined)
    .orderBy(desc(fieldDeliveries.createdAt))
    .limit(filter.limit ?? 20)
  return toFieldUpdateViews(rows)
}

export async function getFieldUpdate(id: string): Promise<FieldUpdateView | null> {
  const db = await getDb()
  const rows = await db.select().from(fieldDeliveries).where(eq(fieldDeliveries.id, id)).limit(1)
  return rows[0] ? (await toFieldUpdateViews(rows))[0] : null
}

/** Posts a delivery: ledger row, feed post, milestone evidence, optional release vote, donor notifications. */
export async function createFieldUpdate(input: CreateFieldUpdateInput, adminAddress: string): Promise<FieldUpdateView> {
  const cause = getCause(input.poolId)
  if (!cause) throw new Error('Unknown cause')
  const db = await getDb()
  const admin = await ensureUser(adminAddress)
  const media = (input.media ?? []).slice(0, 30)
  const amountLamports = Math.max(0, Math.round((input.amountSol ?? 0) * LAMPORTS_PER_SOL))

  // Milestone (optional)
  let milestoneRow = null as typeof milestones.$inferSelect | null
  let campaignRow = null as typeof campaigns.$inferSelect | null
  if (input.milestoneIndex != null) {
    campaignRow = (await db.select().from(campaigns).where(eq(campaigns.poolId, input.poolId)).limit(1))[0] ?? null
    if (!campaignRow) throw new Error('This cause has no campaign yet; run the bootstrap first')
    milestoneRow = (await db.select().from(milestones).where(eq(milestones.campaignId, campaignRow.id))).find((m) => m.index === input.milestoneIndex) ?? null
    if (!milestoneRow) throw new Error(`Milestone ${input.milestoneIndex + 1} does not exist for this cause`)
  }

  const evidence: MilestoneEvidence = {
    summary: [input.title, input.description, input.fiatAmount ? `Spent ${input.fiatAmount}` : '', input.location ? `Location: ${input.location}` : ''].filter(Boolean).join('. ').slice(0, 2000),
    items: media.map((m) => ({ kind: EVIDENCE_KIND[m.kind] ?? 'link', url: m.url, sha256: m.sha256, note: m.note, lat: m.lat, lng: m.lng })),
    submittedBy: admin.username,
    submittedAt: new Date().toISOString(),
  }

  const id = newId('fd')
  const firstImage = media.find((m) => m.kind === 'photo')?.url ?? ''
  const post = await createPost(
    adminAddress,
    `${input.title} — ${cause.name}. ${input.description}`.slice(0, 1000),
    'field_update',
    { poolId: input.poolId, deliveryId: id, amountSol: (amountLamports / LAMPORTS_PER_SOL).toString(), mediaCount: String(media.length), image: firstImage, title: input.title, location: input.location ?? '' }
  )

  let proposalId: string | null = null
  if (milestoneRow && campaignRow) {
    await setMilestoneEvidence(milestoneRow.id, evidence)
    if (input.requestRelease) {
      if (milestoneRow.status === 'pending') {
        const p = await createMilestoneProposal(campaignRow, milestoneRow, adminAddress, 72)
        proposalId = p.id
      } else if (milestoneRow.proposalId) {
        proposalId = milestoneRow.proposalId
      }
    }
  }

  const rows = await db
    .insert(fieldDeliveries)
    .values({
      id,
      poolId: input.poolId,
      milestoneId: milestoneRow?.id ?? null,
      title: input.title.slice(0, 140),
      description: input.description.slice(0, 4000),
      amountLamports,
      fiatAmount: input.fiatAmount?.slice(0, 60) ?? null,
      location: input.location?.slice(0, 140) ?? null,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
      evidence,
      media,
      postedBy: adminAddress,
      proposalId,
      postId: post.id,
      xPostUrl: input.xPostUrl?.slice(0, 300) ?? null,
    })
    .returning()

  // Tell every donor of this cause that their gift arrived.
  try {
    const donors = (await getDonorAddressesForPool(input.poolId)).filter((a) => a !== adminAddress)
    await notifyMany(donors.map((recipientAddress) => ({ recipientAddress, type: 'delivery', message: `Your gift reached them: ${input.title}`, fromUsername: admin.username })))
  } catch (e) {
    console.error('delivery notifications failed', e)
  }

  return (await toFieldUpdateViews(rows))[0]
}
