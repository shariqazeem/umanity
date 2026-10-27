'use client'

/**
 * Data hooks for the cause screens. Each one prefers the aggregate endpoint
 * and falls back to composing the same shape from the older endpoints, so the
 * screens render correctly whichever API is live.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiSend } from '@/lib/client/api'
import { CAUSES, getCause } from '@/lib/causes'
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView, MilestoneView, ProposalView } from '@/lib/data/governance'
import type { DareView } from '@/lib/data/dares'
import type { CauseDetail, CauseListItem, FieldUpdateView } from '@/lib/contracts'
export type { CauseListItem } from '@/lib/contracts'
import { useUmanity } from '@/components/providers/UmanityProvider'

export type NextMilestone = NonNullable<CauseListItem['nextMilestone']>

export interface MilestoneRow extends MilestoneView {
  thresholdSol: number
  cumulativePct: number
}

/** Milestones with the cumulative raise threshold that opens each one. */
export function milestoneRows(campaign: CampaignView | null): MilestoneRow[] {
  if (!campaign) return []
  let cum = 0
  return [...campaign.milestones]
    .sort((a, b) => a.index - b.index)
    .map((m) => {
      cum += m.percentage
      return { ...m, cumulativePct: cum, thresholdSol: (campaign.target_amount * cum) / 100 }
    })
}

export function nextMilestoneFor(campaign: CampaignView | null): NextMilestone | null {
  const rows = milestoneRows(campaign)
  const next = rows.find((m) => m.status !== 'released') ?? null
  return next ? { index: next.index, description: next.description, percentage: next.percentage, thresholdSol: next.thresholdSol, status: next.status } : null
}

export function releasedFrom(campaign: CampaignView | null): number {
  if (!campaign) return 0
  return campaign.milestones.filter((m) => m.status === 'released').reduce((s, m) => s + (m.amount || 0), 0)
}

export function statusLabel(status: string): { label: string; tone: 'gray' | 'green' | 'amber' | 'red' | 'blue' } {
  switch (status) {
    case 'voting':
      return { label: 'Vote open', tone: 'amber' }
    case 'approved':
      return { label: 'Approved', tone: 'green' }
    case 'released':
      return { label: 'Released', tone: 'green' }
    case 'rejected':
      return { label: 'Rejected', tone: 'red' }
    default:
      return { label: 'Upcoming', tone: 'gray' }
  }
}

type Raw = Record<string, unknown>
const asNum = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)

function emptyPool(id: string): PoolView {
  const meta = getCause(id)!
  return { ...meta, poolPda: '', vaultPda: '', totalDonated: 0, vaultBalance: 0, donorCount: 0, lastSyncedAt: null }
}

function normalizeListItem(x: Raw, campaign: CampaignView | null): CauseListItem {
  const id = String(x.id)
  const meta = getCause(id)
  const base = { ...(meta ?? {}), ...(x as unknown as PoolView) } as PoolView
  const camp = (x.campaign as CampaignView | null | undefined) ?? campaign
  return {
    ...base,
    campaign: camp,
    plan: ((x.plan as PoolView['plan'] | undefined) ?? meta?.plan ?? { targetSol: 0, days: 0, milestones: [] }) as PoolView['plan'],
    supporterCount: asNum(x.supporterCount, asNum(x.donorCount)),
    latestUpdate: (x.latestUpdate as FieldUpdateView | null | undefined) ?? null,
    nextMilestone: (x.nextMilestone as NextMilestone | null | undefined) ?? nextMilestoneFor(camp),
    heldSol: asNum(x.heldSol, asNum(x.vaultBalance)),
    raisedSol: asNum(x.raisedSol, asNum(x.totalDonated)),
    releasedSol: asNum(x.releasedSol, releasedFrom(camp)),
  }
}

async function loadPoolsAndCampaigns() {
  const [p, c] = await Promise.all([apiGet<{ pools?: PoolView[] }>('/api/pools').catch(() => ({ pools: [] })), apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns').catch(() => ({ campaigns: [] }))])
  const pools = new Map((p.pools ?? []).map((x) => [x.id, x]))
  const campaigns = new Map((c.campaigns ?? []).map((x) => [x.pool_id, x]))
  return { pools, campaigns }
}

export function useCauseList() {
  const [items, setItems] = useState<CauseListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    let byId = new Map<string, CauseListItem>()
    try {
      const d = await apiGet<{ success?: boolean; causes?: Raw[]; pools?: Raw[] }>('/api/causes')
      const list = d.success !== false ? d.causes ?? d.pools : undefined
      if (Array.isArray(list) && list.length) byId = new Map(list.map((x) => [String(x.id), normalizeListItem(x, null)]))
    } catch {
      /* fall through */
    }
    if (byId.size === 0) {
      try {
        const { pools, campaigns } = await loadPoolsAndCampaigns()
        for (const c of CAUSES) {
          const pool = pools.get(c.id) ?? emptyPool(c.id)
          byId.set(c.id, normalizeListItem(pool as unknown as Raw, campaigns.get(c.id) ?? null))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the causes')
      }
    }
    // Always show all six, in the canonical order.
    setItems(CAUSES.map((c) => byId.get(c.id) ?? normalizeListItem(emptyPool(c.id) as unknown as Raw, null)))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  return { items, error, reload: load }
}

function pickDetail(d: Raw): CauseDetail | null {
  if (d.pool && typeof d.pool === 'object') return d as unknown as CauseDetail
  for (const k of ['detail', 'cause', 'data']) {
    const v = d[k] as Raw | undefined
    if (v && v.pool && typeof v.pool === 'object') return v as unknown as CauseDetail
  }
  return null
}

function normalizeDetail(raw: CauseDetail): CauseDetail {
  const meta = getCause(raw.pool.id)
  const pool = { ...(meta ?? {}), ...raw.pool } as PoolView
  const campaign = raw.campaign ?? null
  return {
    ...raw,
    pool,
    campaign,
    proposals: raw.proposals ?? [],
    supporters: raw.supporters ?? [],
    supporterCount: asNum(raw.supporterCount, pool.donorCount),
    updates: raw.updates ?? [],
    posts: raw.posts ?? [],
    dares: raw.dares ?? [],
    gifts: raw.gifts ?? [],
    raisedSol: asNum(raw.raisedSol, pool.totalDonated),
    heldSol: asNum(raw.heldSol, pool.vaultBalance),
    releasedSol: asNum(raw.releasedSol, releasedFrom(campaign)),
    vault: raw.vault ?? { address: pool.vaultPda, balanceSol: pool.vaultBalance, poolPda: pool.poolPda },
    friendsWhoGave: raw.friendsWhoGave ?? [],
  }
}

async function composeDetail(id: string): Promise<CauseDetail | null> {
  if (!getCause(id)) return null
  const { pools, campaigns } = await loadPoolsAndCampaigns()
  const pool = pools.get(id) ?? emptyPool(id)
  const campaign = campaigns.get(id) ?? null
  const [pr, dr] = await Promise.all([apiGet<{ proposals?: ProposalView[] }>('/api/governance/proposals').catch(() => ({ proposals: [] })), apiGet<{ dares?: DareView[] }>('/api/dares?status=open&limit=50').catch(() => ({ dares: [] }))])
  const proposals = (pr.proposals ?? []).filter((p) => p.recipient?.pool_id === id || (p.campaign_id && campaign && p.campaign_id === campaign.id))
  // Build update cards from milestones that already carry evidence, so proofs show even before the field API is live.
  const updates: FieldUpdateView[] = (campaign?.milestones ?? [])
    .filter((m) => m.evidence || m.attestation || m.status === 'released' || m.status === 'voting')
    .map((m) => ({
      id: `ms_${m.id}`,
      poolId: id,
      poolName: pool.name,
      milestoneId: m.id,
      title: m.description,
      description: m.evidence?.summary ?? '',
      amountSol: m.amount,
      fiatAmount: null,
      location: null,
      deliveredAt: m.evidence?.submittedAt ?? null,
      media: (m.evidence?.items ?? []).filter((i) => i.url).map((i) => ({ url: i.url!, kind: i.kind === 'photo' ? 'photo' : i.kind === 'video' ? 'video' : i.kind === 'receipt' || i.kind === 'invoice' ? 'receipt' : 'document', sha256: i.sha256, note: i.note, lat: i.lat, lng: i.lng })) as FieldUpdateView['media'],
      evidence: m.evidence,
      attestation: m.attestation,
      milestone: m,
      proposal: proposals.find((p) => p.milestone?.id === m.id || p.id === m.proposalId) ?? null,
      proofTxSignature: null,
      releaseTxSignature: m.releaseTxSignature,
      xPostUrl: null,
      createdAt: m.evidence?.submittedAt ?? campaign?.created_at ?? new Date().toISOString(),
    }))
  return normalizeDetail({
    pool,
    campaign,
    proposals,
    supporters: [],
    supporterCount: pool.donorCount,
    updates,
    posts: [],
    dares: (dr.dares ?? []).filter((d) => d.poolId === id),
    gifts: [],
    raisedSol: pool.totalDonated,
    heldSol: pool.vaultBalance,
    releasedSol: releasedFrom(campaign),
    vault: { address: pool.vaultPda, balanceSol: pool.vaultBalance, poolPda: pool.poolPda },
    friendsWhoGave: [],
  })
}

export function useCauseDetail(id: string | undefined, viewer: string | null) {
  const [detail, setDetail] = useState<CauseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    if (!getCause(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let next: CauseDetail | null = null
    let fromApi = false
    try {
      const d = await apiGet<Raw>(`/api/causes/${encodeURIComponent(id)}${viewer ? `?viewer=${viewer}` : ''}`, { timeoutMs: 30_000 })
      if (d.success !== false) {
        const picked = pickDetail(d)
        if (picked) {
          next = normalizeDetail(picked)
          fromApi = true
        }
      }
    } catch {
      /* fall through */
    }
    if (!next) {
      try {
        next = await composeDetail(id)
      } catch {
        next = null
      }
    }
    // Never replace a full answer with a thinner fallback on a later reload.
    setDetail((prev) => (next && (fromApi || !prev) ? next : prev ?? next))
    setNotFound((prev) => (next ? false : prev || false))
    setLoading(false)
  }, [id, viewer])

  useEffect(() => {
    load()
  }, [load])
  return { detail, loading, notFound, reload: load }
}

/** Voting state for the signed-in person, plus the actions. */
export function useVoting(address: string | null) {
  const { toast } = useUmanity()
  const [myVotes, setMyVotes] = useState<Record<string, number | null>>({})
  const [power, setPower] = useState(0)
  const load = useCallback(async () => {
    if (!address) {
      setMyVotes({})
      setPower(0)
      return
    }
    try {
      const r = await apiGet<{ myVotes?: Record<string, number | null>; votingPower?: number }>(`/api/governance/proposals?voter=${address}`)
      setMyVotes(r.myVotes ?? {})
      setPower(r.votingPower ?? 0)
    } catch {
      /* ignore */
    }
  }, [address])
  useEffect(() => {
    load()
  }, [load])

  const vote = useCallback(
    async (proposalId: string, option: number) => {
      if (!address) return false
      const r = await apiSend<{ success: boolean; error?: string; voteWeight?: number }>('/api/governance/vote', { proposalId, voterAddress: address, voteOption: option })
      if (!r.success) {
        toast(r.error || 'Vote failed', 'err')
        return false
      }
      toast(`Vote counted with ${(r.voteWeight ?? 0).toLocaleString()} power.`, 'ok')
      await load()
      return true
    },
    [address, toast, load]
  )

  const execute = useCallback(
    async (proposalId: string) => {
      const r = await apiSend<{ success: boolean; error?: string; message?: string }>('/api/governance/execute', { proposalId })
      toast(r.success ? r.message || 'Votes tallied.' : r.error || 'Could not tally the votes', r.success ? 'ok' : 'err')
      return r.success
    },
    [toast]
  )

  return { myVotes, power, vote, execute, reload: load }
}

export function useIsAdmin(address: string | null) {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!address) {
      setIsAdmin(false)
      return
    }
    apiGet<{ isAdmin?: boolean }>(`/api/admin/me?address=${address}`)
      .then((r) => setIsAdmin(!!r.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [address])
  return isAdmin
}
