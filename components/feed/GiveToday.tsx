'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Img, Progress, Skeleton } from '@/components/shared/ui'
import { apiGet, fmtSol } from '@/lib/client/api'
import { CAUSES } from '@/lib/causes'
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView } from '@/lib/data/governance'
import { normalizeCause, type CauseSummary } from './types'

export function useCauses() {
  const [causes, setCauses] = useState<CauseSummary[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const d = await apiGet<{ success?: boolean; causes?: Record<string, unknown>[] }>('/api/causes')
        if (Array.isArray(d.causes) && d.causes.length) {
          if (alive) setCauses(d.causes.map((c) => normalizeCause(c)))
          return
        }
      } catch {
        /* fall through */
      }
      try {
        const [p, c] = await Promise.all([apiGet<{ pools?: PoolView[] }>('/api/pools'), apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns')])
        const camps = Object.fromEntries((c.campaigns ?? []).map((x) => [x.pool_id, x]))
        const pools = p.pools ?? []
        const list = CAUSES.map((meta) => {
          const pool = pools.find((x) => x.id === meta.id)
          return normalizeCause({ id: meta.id, totalDonated: pool?.totalDonated, vaultBalance: pool?.vaultBalance, donorCount: pool?.donorCount }, camps[meta.id] ?? null)
        })
        if (alive) setCauses(list)
      } catch {
        if (alive) setCauses(CAUSES.map((meta) => normalizeCause({ id: meta.id }, null)))
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])
  return causes
}

export function GiveToday() {
  const { openGive } = useUmanity()
  const causes = useCauses()
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">Give today</h2>
        <Link href="/causes" className="text-[12.5px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f]">
          All causes
        </Link>
      </div>
      <div className="-mx-5 sm:-mx-8 px-5 sm:px-8 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 w-max pb-1">
          {causes === null
            ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-[196px] h-[214px] rounded-[20px]" />)
            : causes.map((c) => {
                const next = c.nextMilestone
                const raised = c.totalDonated
                const target = next?.thresholdSol ?? c.onchainCampaign?.target_amount ?? 0
                return (
                  <div key={c.id} className="card w-[196px] flex-shrink-0 overflow-hidden">
                    <Link href={`/causes/${c.id}`} className="block h-[104px] overflow-hidden bg-black/[0.04]">
                      {c.image && <Img src={c.image.replace('w=1600', 'w=480')} alt={c.imageAlt} />}
                    </Link>
                    <div className="p-3.5">
                      <Link href={`/causes/${c.id}`} className="block text-[14px] font-semibold leading-tight truncate">
                        {c.name}
                      </Link>
                      <div className="mt-2.5">
                        <Progress value={raised} max={target} />
                        <p className="text-[11px] text-[#6e6e73] mt-1.5 num truncate">{target > 0 ? `${fmtSol(raised, 2)} of ${fmtSol(target, target >= 10 ? 0 : 2)} SOL to the next delivery` : `${fmtSol(raised, 2)} SOL given`}</p>
                      </div>
                      <Btn tone="accent" size="sm" full className="mt-3" onClick={() => openGive({ causeId: c.id })}>
                        Give
                      </Btn>
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
    </section>
  )
}
