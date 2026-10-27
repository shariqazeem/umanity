'use client'

import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, fmtSol, fmtUsd } from '@/lib/client/api'
import { Card, Btn, Pill, Mono, Progress, AccountLink, Skeleton } from '@/components/shared/ui'
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView } from '@/lib/data/governance'
import { QuickGive } from '@/components/give/QuickGive'

const RAILS = ['SOL', 'ETH', 'BASE', 'ARB', 'BTC', 'TON', 'NEAR']

export function CausesTab({ onGive }: { onGive: (cause?: string, mode?: 'anychain' | 'solana') => void }) {
  const { solPrice, address } = useUmanity()
  const [pools, setPools] = useState<PoolView[] | null>(null)
  const [campaigns, setCampaigns] = useState<Record<string, CampaignView>>({})
  const [filter, setFilter] = useState<'all' | 'field' | 'trust' | 'closing'>('all')
  const [quick, setQuick] = useState<PoolView | null>(null)
  const [proof, setProof] = useState<Record<string, string[]>>({})

  const load = async () => {
    const [p, c] = await Promise.all([apiGet<{ pools?: PoolView[] }>('/api/pools'), apiGet<{ campaigns?: CampaignView[] }>('/api/campaigns')])
    setPools(p.pools ?? [])
    setCampaigns(Object.fromEntries((c.campaigns ?? []).map((x) => [x.pool_id, x])))
  }
  useEffect(() => {
    load()
  }, [])
  useEffect(() => {
    if (!address || !pools) return
    pools.forEach((p) => apiGet<{ matchedUsernames?: string[] }>(`/api/social-proof?address=${address}&poolId=${p.id}`).then((r) => r.matchedUsernames?.length && setProof((s) => ({ ...s, [p.id]: r.matchedUsernames! }))).catch(() => {}))
  }, [address, pools])

  const list = (pools ?? []).filter((p) => {
    if (filter === 'field') return p.deliveryMode === 'field'
    if (filter === 'trust') return p.deliveryMode === 'trust'
    if (filter === 'closing') {
      const c = campaigns[p.id]
      return c ? c.milestones.some((m) => m.status === 'voting' || m.status === 'approved') : false
    }
    return true
  })

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Causes</h2>
          <p className="text-[13px] text-[#52525B]">Six vaults on Solana. Money leaves only when the community votes a milestone through.</p>
        </div>
        <div className="flex gap-1 bg-[#F3F3F1] rounded-xl p-1">
          {(
            [
              ['all', `All (${pools?.length ?? 6})`],
              ['field', '🚚 Field delivery'],
              ['trust', '🏛 Charity trusts'],
              ['closing', '⚡ Vote pending'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${filter === id ? 'bg-white shadow-sm' : 'text-[#52525B]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!pools ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-[20px]" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 animate-stagger">
          {list.map((p) => {
            const c = campaigns[p.id]
            const target = c?.target_amount ?? 0
            const raised = c?.total_raised ?? p.totalDonated
            const done = c ? c.milestones.filter((m) => m.status === 'released').length : 0
            const segs = c ? c.milestones.slice(0, -1).reduce<number[]>((acc, m) => [...acc, (acc[acc.length - 1] ?? 0) + m.percentage], []) : undefined
            const voting = c?.milestones.find((m) => m.status === 'voting' || m.status === 'approved')
            return (
              <Card key={p.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#F3F3F1] flex items-center justify-center text-2xl">{p.emoji}</div>
                  <div className="flex gap-1.5">
                    <Pill tone="emerald">✓ escrow</Pill>
                    <Pill tone={p.deliveryMode === 'field' ? 'coral' : 'gray'}>{p.deliveryMode === 'field' ? 'field' : p.category}</Pill>
                  </div>
                </div>
                <h3 className="text-[15px] font-bold leading-tight">{p.name}</h3>
                <p className="text-[12px] text-[#52525B] mt-1 line-clamp-2">{p.description}</p>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <Mono className="text-[13px] font-bold">
                      {fmtSol(p.vaultBalance, 3)} SOL <span className="text-[#A1A1AA] font-normal">locked</span>
                    </Mono>
                    <span className="text-[11px] text-[#52525B]">
                      {c ? (
                        <>
                          <Mono>{fmtSol(raised, 2)}</Mono> / <Mono>{fmtSol(target, 0)}</Mono> SOL · milestone {Math.min(done + 1, c.milestones.length)} of {c.milestones.length}
                        </>
                      ) : (
                        `${p.donorCount} donors`
                      )}
                    </span>
                  </div>
                  <Progress value={raised} max={target || Math.max(raised, 1)} tone="emerald" segments={segs} />
                  {solPrice && <p className="text-[10px] text-[#A1A1AA] mt-1">{fmtUsd(p.vaultBalance * solPrice)} escrowed · {p.donorCount} donors</p>}
                  {voting && <p className="text-[11px] text-indigo-700 mt-1.5">⚡ Milestone {voting.index + 1} {voting.status === 'voting' ? 'is up for vote' : 'approved, release pending'}: {voting.description}</p>}
                </div>

                {proof[p.id] && <p className="text-[11px] text-emerald-700 mt-2">Backed by {proof[p.id].map((u) => `@${u}`).join(', ')} from your network</p>}

                <div className="flex items-center gap-1 mt-3 text-[9px] font-semibold text-[#A1A1AA]">
                  {RAILS.map((r) => (
                    <span key={r} className="px-1.5 py-0.5 rounded bg-[#F3F3F1]">
                      {r}
                    </span>
                  ))}
                  <span className="ml-1">via NEAR Intents</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#0F172A] text-[#38BDF8]">🛡️</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-4">
                  <Btn size="sm" onClick={() => setQuick(p)}>
                    Give SOL
                  </Btn>
                  <Btn size="sm" tone="outline" onClick={() => onGive(p.id, 'anychain')}>
                    Any chain
                  </Btn>
                  <Btn size="sm" tone="secondary" onClick={() => onGive(p.id, 'solana')}>
                    🛡️ Discreet
                  </Btn>
                </div>
                <div className="flex items-center justify-between mt-3 text-[10px] text-[#A1A1AA]">
                  <span>
                    vault <AccountLink address={p.vaultPda} />
                  </span>
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#111113]">
                      charity site ↗
                    </a>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <QuickGive pool={quick} onClose={() => setQuick(null)} onDone={load} />
    </div>
  )
}
