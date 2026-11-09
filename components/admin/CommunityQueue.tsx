'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Signer } from '@/components/providers/UmanityProvider'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { adminFetch } from '@/lib/client/admin'
import { listTotal, usdText, type DropMeta } from '@/lib/umanity/drops'
import { dropHref } from '@/components/drops/DropParts'

type Proposal = { id: string; title: string; place: string; emoji: string; meta: DropMeta; goalUsd: number; capUsd: number; deadline: string; status: string; reason: string | null; dropId: number | null; createdAt: string; proposer: string; contact: string }
type Submission = { id: string; dropId: number; runner: string; title: string; body: string; xPostUrl: string | null; links: string[]; status: string; createdAt: string }

/** Community drops waiting for the team: proposals to open, and runners' proof to post on-chain. */
export function CommunityQueue({ signer }: { signer: Signer }) {
  const { toast } = useUmanity()
  const [q, setQ] = useState<{ proposals: Proposal[]; submissions: Submission[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await adminFetch<{ proposals?: Proposal[]; submissions?: Submission[]; error?: string }>(signer, '/api/admin/community', { method: 'GET' }).catch(() => null)
    if (r?.proposals) setQ({ proposals: r.proposals, submissions: r.submissions ?? [] })
  }, [signer])
  useEffect(() => {
    load()
  }, [load])

  const act = async (type: 'proposal' | 'submission', id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? (window.prompt('Why? The runner sees this.') ?? '') : ''
    if (action === 'reject' && !reason) return
    setBusy(id)
    const r = await adminFetch<{ error?: string }>(signer, '/api/admin/community', { body: { type, id, action, reason } }).catch((e) => ({ error: (e as Error).message }))
    setBusy(null)
    if (r.error) toast(r.error, 'err')
    else toast(action === 'approve' ? (type === 'proposal' ? 'Opened on Solana' : 'Proof posted on-chain') : 'Done', 'ok')
    load()
  }

  if (!q) return <div className="card p-5 skeleton h-24" />
  const pending = q.proposals.filter((p) => p.status === 'pending')
  const waiting = q.submissions.filter((s) => s.status === 'pending')
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-bold text-[16px]">Community drops</h2>
        <p className="text-[12.5px] text-[#86868b]">Check the prices, the place and the runner before opening a drop. A runner is paid only after proof.</p>
      </div>

      {pending.length === 0 && waiting.length === 0 && <p className="text-[13px] text-[#86868b]">Nothing waiting.</p>}

      {pending.map((p) => (
        <article key={p.id} className="rounded-2xl border border-black/[0.06] p-4">
          <p className="font-semibold text-[14px]">
            {p.emoji} {p.title} <span className="text-[#86868b] font-normal">· {p.place}</span>
          </p>
          <p className="text-[12px] text-[#86868b] mt-0.5">
            {usdText(p.goalUsd, 2)} goal (list {usdText(listTotal(p.meta.items), 2)}) · cap {usdText(p.capUsd, 0)} · by {new Date(p.deadline).toLocaleDateString()} · runner {p.proposer.slice(0, 4)}…{p.proposer.slice(-4)} · {p.contact}
          </p>
          <p className="text-[12.5px] text-[#525252] mt-2">{p.meta.story}</p>
          <ul className="text-[12px] text-[#525252] mt-2 grid sm:grid-cols-2 gap-x-4">
            {p.meta.items.map((it, i) => (
              <li key={i}>
                {it.qty} × {it.name} @ {usdText(it.unitUsd, 2)}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button onClick={() => act('proposal', p.id, 'approve')} disabled={busy === p.id} className="btn-primary px-4 py-2 !text-[12.5px]">
              {busy === p.id ? 'Opening…' : 'Open it on Solana'}
            </button>
            <button onClick={() => act('proposal', p.id, 'reject')} disabled={busy === p.id} className="btn-secondary px-4 py-2 !text-[12.5px]">
              Not approved
            </button>
          </div>
        </article>
      ))}

      {waiting.map((s) => (
        <article key={s.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="font-semibold text-[14px]">
            Proof for <Link href={dropHref(s.dropId)} className="underline">Drop #{s.dropId + 1}</Link>: {s.title}
          </p>
          {s.body && <p className="text-[12.5px] text-[#525252] mt-1">{s.body}</p>}
          <ul className="text-[12px] mt-2 space-y-0.5">
            {[s.xPostUrl, ...s.links].filter(Boolean).map((l) => (
              <li key={l}>
                <a href={l!} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline break-all">
                  {l}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button onClick={() => act('submission', s.id, 'approve')} disabled={busy === s.id} className="btn-primary px-4 py-2 !text-[12.5px]">
              {busy === s.id ? 'Posting…' : 'Post proof on-chain'}
            </button>
            <button onClick={() => act('submission', s.id, 'reject')} disabled={busy === s.id} className="btn-secondary px-4 py-2 !text-[12.5px]">
              Ask for better proof
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}
