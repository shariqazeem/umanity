'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/lib/client/api'
import { CAUSES, getCause } from '@/lib/causes'
import type { TransparencyReport } from '@/lib/contracts'
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView } from '@/lib/data/governance'
import type { PlatformStats } from '@/lib/client/hooks'
import { SOLANA_CLUSTER, UMANITY_DONATIONS_PROGRAM_ID, UMANITY_TIPS_PROGRAM_ID, UMANITY_ORG_WALLET, UMANITY_TREASURY } from '@/lib/solana/constants'
import { CROSSCHAIN_VAULT } from '@/lib/intents/config'

type Raw = Record<string, unknown>

function pick(d: Raw): TransparencyReport | null {
  if (d.totals && d.vaults) return d as unknown as TransparencyReport
  const r = d.report as Raw | undefined
  if (r && r.totals && r.vaults) return r as unknown as TransparencyReport
  return null
}

function normalize(r: TransparencyReport): TransparencyReport {
  return {
    ...r,
    programs: r.programs ?? { donations: UMANITY_DONATIONS_PROGRAM_ID, tips: UMANITY_TIPS_PROGRAM_ID },
    wallets: r.wallets ?? { authority: '', treasury: UMANITY_TREASURY, orgWallet: UMANITY_ORG_WALLET, crossChainVault: CROSSCHAIN_VAULT },
    vaults: (r.vaults ?? []).map((v) => ({ ...v, name: v.name || getCause(v.poolId)?.name || v.poolId })),
    releases: r.releases ?? [],
    deliveries: r.deliveries ?? [],
    fees: r.fees ?? { dareFeeBps: 150, dareFeesSol: 0, intentsFeeBps: 50, intentsFeeUsd: 0, x402Calls: 0, x402RevenueUsd: 0, routingFeesSol: 0 },
  }
}

async function compose(): Promise<TransparencyReport> {
  const [p, c, s] = await Promise.all([
    apiGet<{ pools?: PoolView[] }>('/api/pools').catch(() => ({ pools: [] })),
    apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns').catch(() => ({ campaigns: [] })),
    apiGet<{ stats?: PlatformStats }>('/api/platform/stats').catch(() => ({ stats: undefined })),
  ])
  const pools = new Map((p.pools ?? []).map((x) => [x.id, x]))
  const campaigns = new Map((c.campaigns ?? []).map((x) => [x.pool_id, x]))
  const stats = s.stats
  const vaults = CAUSES.map((cause) => {
    const pool = pools.get(cause.id)
    const camp = campaigns.get(cause.id)
    const released = camp ? camp.milestones.filter((m) => m.status === 'released').reduce((a, m) => a + (m.amount || 0), 0) : 0
    return { poolId: cause.id, name: cause.name, vaultPda: pool?.vaultPda ?? '', poolPda: pool?.poolPda ?? '', balanceSol: pool?.vaultBalance ?? 0, raisedSol: pool?.totalDonated ?? 0, releasedSol: released, donorCount: pool?.donorCount ?? 0, lastSyncedAt: pool?.lastSyncedAt ?? null }
  })
  const releases = Array.from(campaigns.values()).flatMap((camp) =>
    camp.milestones
      .filter((m) => m.status === 'released')
      .map((m) => ({ poolId: camp.pool_id, poolName: getCause(camp.pool_id)?.name ?? camp.poolName, milestoneIndex: m.index, description: m.description, amountSol: m.amount, txSignature: m.releaseTxSignature, attestation: m.attestation, status: m.status }))
  )
  const raised = vaults.reduce((a, v) => a + v.raisedSol, 0)
  const held = vaults.reduce((a, v) => a + v.balanceSol, 0)
  const releasedSol = vaults.reduce((a, v) => a + v.releasedSol, 0)
  return normalize({
    generatedAt: new Date().toISOString(),
    network: SOLANA_CLUSTER,
    programs: { donations: UMANITY_DONATIONS_PROGRAM_ID, tips: UMANITY_TIPS_PROGRAM_ID },
    wallets: { authority: '', treasury: UMANITY_TREASURY, orgWallet: UMANITY_ORG_WALLET, crossChainVault: CROSSCHAIN_VAULT },
    totals: { raisedSol: raised, heldSol: held, releasedSol, donors: stats?.totalDonors ?? vaults.reduce((a, v) => a + v.donorCount, 0), gifts: stats?.totalTransactions ?? 0, crossChainGifts: stats?.crossChainCount ?? 0, crossChainSol: stats?.crossChainVolume ?? 0, causes: CAUSES.length },
    vaults,
    releases,
    deliveries: [],
    fees: { dareFeeBps: 150, dareFeesSol: 0, intentsFeeBps: 50, intentsFeeUsd: 0, x402Calls: stats?.x402Calls ?? 0, x402RevenueUsd: Number(stats?.x402Revenue ?? 0) || 0, routingFeesSol: 0 },
  })
}

export function useTransparency() {
  const [report, setReport] = useState<TransparencyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    let r: TransparencyReport | null = null
    try {
      const d = await apiGet<Raw>('/api/transparency', { timeoutMs: 25_000 })
      if (d.success !== false) {
        const picked = pick(d)
        if (picked) r = normalize(picked)
      }
    } catch {
      /* fall through */
    }
    if (!r) {
      try {
        r = await compose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the ledger')
      }
    }
    setReport(r)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { report, error, reload: load }
}
