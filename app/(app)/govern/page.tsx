'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Img } from '@/components/shared/ui'
import { ProofPanel } from '@/components/causes/ProofPanel'
import { useIsAdmin, useVoting } from '@/components/causes/data'
import { apiGet, fmtSol, timeAgo } from '@/lib/client/api'
import { getCause } from '@/lib/causes'
import type { FieldUpdateView } from '@/lib/contracts'

const TABS = [
  { key: 'open', label: 'Open votes' },
  { key: 'released', label: 'Released' },
  { key: 'all', label: 'All deliveries' },
] as const

export default function GovernPage() {
  const { address } = useUmanity()
  const { myVotes, power, vote, execute, reload: reloadVotes } = useVoting(address)
  const isAdmin = useIsAdmin(address)
  const [updates, setUpdates] = useState<FieldUpdateView[] | null>(null)
  const [summary, setSummary] = useState<{ active: number; total: number; executed: number; escrowAwaitingVote: number } | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('open')

  const load = useCallback(async () => {
    const [u, p] = await Promise.all([
      apiGet<{ updates?: FieldUpdateView[] }>('/api/field/updates?limit=50').catch(() => ({ updates: [] as FieldUpdateView[] })),
      apiGet<{ summary?: { active: number; total: number; executed: number; escrowAwaitingVote: number } }>('/api/governance/proposals').catch(() => ({ summary: undefined })),
    ])
    setUpdates(u.updates ?? [])
    setSummary(p.summary ?? null)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isOpen = (u: FieldUpdateView) => !!u.proposal && u.proposal.status === 'active'
  const list = (updates ?? []).filter((u) => (tab === 'open' ? isOpen(u) : tab === 'released' ? u.milestone?.status === 'released' || !!u.releaseTxSignature : true))

  useEffect(() => {
    // Land on whatever has content.
    if (updates && tab === 'open' && !updates.some(isOpen) && updates.length > 0) setTab('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updates])

  return (
    <div>
      <section className="pt-2 mb-5">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Govern</h2>
        <p className="text-[#86868b] text-sm">Escrowed money only moves when the donors say the proof is good enough.</p>
      </section>

      {/* Power + pipeline */}
      <section className="council-card p-5 md:p-6 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Your voting power" value={address ? power.toLocaleString() : '—'} sub={address ? (power > 0 ? '1 SOL given = 1,000' : 'Give once to vote') : 'Sign in to vote'} />
          <Metric label="Open votes" value={summary ? String(summary.active) : '—'} sub={summary ? `${summary.total} so far` : undefined} />
          <Metric label="Awaiting a vote" value={summary ? `${fmtSol(summary.escrowAwaitingVote, 2)}` : '—'} sub="SOL in escrow" />
        </div>
        <div className="mt-5 pt-5 border-t border-black/[0.04] grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['🚚', 'Delivered', 'Field team posts photos, receipts, location'],
            ['🤖', 'Audited', 'AI oracle checks the proof, paid per call via x402'],
            ['🗳️', 'Voted', "That cause's donors approve or keep it locked"],
            ['🔓', 'Released', 'release_milestone_funds moves the SOL on-chain'],
          ].map(([icon, t, s], i) => (
            <div key={t} className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-sm flex-shrink-0">{icon}</div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold">
                  <span className="text-[#aeaeb2] mr-1">{i + 1}</span>
                  {t}
                </p>
                <p className="text-[10.5px] text-[#86868b] leading-snug mt-0.5">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors ${tab === t.key ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
            {t.label}
          </button>
        ))}
        <Link href="/transparency" className="ml-auto pl-2 text-[12px] font-semibold text-emerald-600 hover:underline whitespace-nowrap flex-shrink-0">
          Full ledger →
        </Link>
      </div>

      {updates === null ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-56 rounded-[20px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-xl">🗳️</div>
          <p className="text-[#1d1d1f] font-semibold text-[15px] mb-1">{tab === 'open' ? 'No vote is open right now' : 'Nothing here yet'}</p>
          <p className="text-[#86868b] text-[13px] max-w-sm mx-auto">When the field team posts a delivery, its release vote opens here. Donors of that cause get a notification.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-stagger">
          {list.map((u) => (
            <ProofItem
              key={u.id}
              update={u}
              isAdmin={isAdmin}
              myVote={u.proposal ? myVotes[u.proposal.id] ?? null : null}
              power={power}
              onVote={vote}
              onExecute={execute}
              onChange={() => {
                load()
                reloadVotes()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
      <p className="text-[22px] md:text-[28px] font-bold counter leading-tight mt-1">{value}</p>
      {sub && <p className="text-[10.5px] text-[#aeaeb2] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function ProofItem(props: { update: FieldUpdateView; isAdmin: boolean; myVote: number | null; power: number; onVote: (id: string, o: number) => Promise<boolean>; onExecute: (id: string) => Promise<boolean>; onChange: () => void }) {
  const u = props.update
  const cause = getCause(u.poolId)
  const photos = (u.media ?? []).filter((m) => m.kind === 'photo').slice(0, 4)
  return (
    <article className="card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-xl flex-shrink-0">{cause?.emoji}</div>
        <div className="flex-1 min-w-0">
          <Link href={`/causes/${u.poolId}`} className="text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f]">
            {u.poolName}
            {u.milestone ? ` · Milestone ${u.milestone.index + 1}` : ''}
          </Link>
          <h3 className="text-[15px] font-bold leading-snug mt-0.5">{u.title}</h3>
          <p className="text-[11px] text-[#aeaeb2] mt-0.5">
            {u.location ? `${u.location} · ` : ''}
            {timeAgo(u.deliveredAt ?? u.createdAt)}
            {u.amountSol > 0 ? ` · ${fmtSol(u.amountSol, 3)} SOL spent` : ''}
          </p>
        </div>
      </div>
      {u.description && <p className="text-[13px] text-[#525252] leading-relaxed mt-3 line-clamp-3">{u.description}</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {photos.map((m, i) => (
            <a key={m.url + i} href={m.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden bg-black/[0.04] block">
              <Img src={m.url} alt={m.note || u.title} />
            </a>
          ))}
        </div>
      )}
      <ProofPanel {...props} />
    </article>
  )
}
