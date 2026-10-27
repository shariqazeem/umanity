'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend, fmtSol, timeAgo } from '@/lib/client/api'
import { Card, Btn, Pill, Mono, TxLink, AccountLink, Skeleton, Empty } from '@/components/shared/ui'
import type { ProposalView, MilestoneView } from '@/lib/data/governance'
import type { OracleAttestation } from '@/lib/db'
import { payWithX402 } from '@/lib/client/x402'

interface Summary {
  active: number
  total: number
  executed: number
  escrowAwaitingVote: number
}

export function GovernTab() {
  const { address, user } = useUmanity()
  const [proposals, setProposals] = useState<ProposalView[] | null>(null)
  const [myVotes, setMyVotes] = useState<Record<string, number | null>>({})
  const [summary, setSummary] = useState<Summary | null>(null)
  const [power, setPower] = useState(0)
  const [filter, setFilter] = useState<'active' | 'all' | 'executed'>('active')

  const load = useCallback(async () => {
    const r = await apiGet<{ proposals?: ProposalView[]; myVotes?: Record<string, number | null>; summary?: Summary; votingPower?: number }>(`/api/governance/proposals${address ? `?voter=${address}` : ''}`)
    setProposals(r.proposals ?? [])
    setMyVotes(r.myVotes ?? {})
    setSummary(r.summary ?? null)
    setPower(r.votingPower ?? 0)
  }, [address])

  useEffect(() => {
    load()
  }, [load])

  const list = (proposals ?? []).filter((p) => (filter === 'all' ? true : filter === 'active' ? p.status === 'active' : p.status !== 'active'))

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-4">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">Govern</h2>
        <p className="text-[13px] text-[#52525B]">Votes move real SOL out of escrow. The AI Impact Oracle audits the evidence first; its verdict is hashed on-chain.</p>
      </div>

      <Card className="p-5 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA]">Your voting power</p>
            <Mono className="text-[26px] font-bold tracking-tight">{power.toLocaleString()}</Mono>
            <p className="text-[11px] text-[#52525B]">{user ? `1 SOL given = 1,000 power` : 'connect to vote'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA]">Escrow awaiting vote</p>
            <Mono className="text-[26px] font-bold tracking-tight">{fmtSol(summary?.escrowAwaitingVote ?? 0, 2)}</Mono>
            <p className="text-[11px] text-[#52525B]">SOL across {summary?.active ?? 0} proposals</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA]">Executed</p>
            <Mono className="text-[26px] font-bold tracking-tight">{summary?.executed ?? 0}</Mono>
            <p className="text-[11px] text-[#52525B]">of {summary?.total ?? 0} total</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA]">Oracle</p>
            <p className="text-[14px] font-bold mt-1">x402 · $0.01 USDC</p>
            <p className="text-[11px] text-[#52525B]">per audit, agents welcome</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-1 bg-[#F3F3F1] rounded-xl p-1 w-fit mb-4">
        {(['active', 'all', 'executed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize ${filter === f ? 'bg-white shadow-sm' : 'text-[#52525B]'}`}>
            {f}
          </button>
        ))}
      </div>

      {proposals === null ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[20px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty title="No proposals in this view" sub="Fund-release votes open automatically when a cause crosses a milestone threshold." />
      ) : (
        <div className="space-y-3 animate-stagger">
          {list.map((p) => (
            <ProposalCard key={p.id} p={p} myVote={myVotes[p.id] ?? null} onChange={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProposalCard({ p, myVote, onChange }: { p: ProposalView; myVote: number | null; onChange: () => void }) {
  const { address, toast, startDemo } = useUmanity()
  const [busy, setBusy] = useState<string | null>(null)
  const closed = new Date(p.closes_at) < new Date()
  const active = p.status === 'active' && !closed
  const canExecute = p.status === 'active' && closed
  const m = p.milestone
  const yes = p.results[0]
  const no = p.results[1]

  const vote = async (option: number) => {
    let voter = address
    if (!voter) {
      const r = await startDemo()
      if (r.error) return toast(r.error, 'err')
      toast('Demo wallet ready. Donate once to earn voting power, then vote.', 'info')
      return
    }
    setBusy('vote')
    const r = await apiSend<{ success: boolean; error?: string; voteWeight?: number }>('/api/governance/vote', { proposalId: p.id, voterAddress: voter, voteOption: option })
    setBusy(null)
    if (!r.success) return toast(r.error || 'Vote failed', 'err')
    toast(`Voted with ${r.voteWeight} power`, 'ok')
    onChange()
  }

  const execute = async () => {
    setBusy('execute')
    const r = await apiSend<{ success: boolean; error?: string; message?: string }>('/api/governance/execute', { proposalId: p.id })
    setBusy(null)
    if (!r.success) return toast(r.error || 'Execute failed', 'err')
    toast(r.message || 'Executed', 'ok')
    onChange()
  }

  const release = async () => {
    if (!m) return
    setBusy('release')
    const r = await apiSend<{ success: boolean; error?: string; signature?: string; amount?: number }>('/api/governance/release', { milestoneId: m.id })
    setBusy(null)
    if (!r.success) return toast(r.error || 'Release failed', 'err')
    toast(`Released ${fmtSol(r.amount ?? 0, 3)} SOL from escrow on-chain`, 'ok')
    onChange()
  }

  return (
    <Card className={`p-5 ${p.proposal_type === 'fund_release' ? 'border-l-4 border-l-emerald-400' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {p.proposal_type === 'fund_release' ? <Pill tone="emerald">Fund release</Pill> : <Pill tone="gray">General</Pill>}
            <span className="text-[11px] text-[#A1A1AA]">{active ? `closes ${timeAgo(p.closes_at)}` : p.status === 'executed' ? 'executed' : 'voting ended'}</span>
          </div>
          <h3 className="text-[15px] font-bold leading-snug">{p.title}</h3>
        </div>
        {p.escrowAmount > 0 && (
          <div className="text-right flex-shrink-0">
            <Mono className="text-[18px] font-bold">{fmtSol(p.escrowAmount, 3)} SOL</Mono>
            <p className="text-[10px] text-[#A1A1AA]">on the line</p>
          </div>
        )}
      </div>
      <p className="text-[12px] text-[#52525B] leading-relaxed">{p.description}</p>

      {m && <OraclePanel milestone={m} onChange={onChange} />}

      {p.recipient && (
        <p className="text-[10px] text-[#A1A1AA] mt-3">
          Disbursement: vault → <AccountLink address={p.recipient.address} label="Umanity org wallet" /> → field delivery with receipts · MultiHopper multi-send for supplier payouts
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        {[yes, no].map((r, i) =>
          r ? (
            <button key={i} onClick={() => vote(i)} disabled={!active || myVote !== null || busy === 'vote'} className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all disabled:cursor-default ${myVote === i ? 'border-[#111113]' : active && myVote === null ? 'border-[#ECECED] hover:border-[#111113]' : 'border-[#F3F3F1]'}`}>
              <div className={`absolute inset-0 ${i === 0 ? 'bg-emerald-50' : 'bg-red-50'}`} style={{ width: `${r.percentage}%` }} />
              <div className="relative flex items-center justify-between">
                <span className="text-[13px] font-semibold">
                  {i === 0 ? '✅' : '🛑'} {r.option}
                </span>
                <Mono className="text-[13px] font-bold">{r.percentage.toFixed(0)}%</Mono>
              </div>
              <p className="relative text-[10px] text-[#52525B] mt-0.5">
                {r.voteCount} voters · {r.totalWeight.toLocaleString()} power{myVote === i ? ' · your vote' : ''}
              </p>
            </button>
          ) : null
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {canExecute && (
          <Btn size="sm" onClick={execute} loading={busy === 'execute'}>
            Execute: tally votes
          </Btn>
        )}
        {p.status === 'executed' && p.result && <Pill tone={p.result.approved ? 'emerald' : 'coral'}>{p.result.approved ? 'Passed' : 'Rejected'}</Pill>}
        {m?.status === 'approved' && (
          <Btn size="sm" tone="emerald" onClick={release} loading={busy === 'release'}>
            Release escrow on-chain
          </Btn>
        )}
        {m?.status === 'released' && m.releaseTxSignature && (
          <>
            <Pill tone="emerald">Released</Pill>
            <TxLink sig={m.releaseTxSignature} label="release tx on Solscan" />
          </>
        )}
        <span className="ml-auto text-[10px] text-[#A1A1AA]">{p.totalVoters} voters · {p.totalWeight.toLocaleString()} power</span>
      </div>
    </Card>
  )
}

function OraclePanel({ milestone, onChange }: { milestone: MilestoneView; onChange: () => void }) {
  const { signer, toast, startDemo } = useUmanity()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const att: OracleAttestation | null = milestone.attestation
  const ev = milestone.evidence

  const reverify = async () => {
    let s = signer
    if (!s) {
      const r = await startDemo()
      if (r.error) return toast(r.error, 'err')
      toast('Demo wallet created. It needs devnet USDC for x402 (faucet.circle.com). Try again after funding.', 'info')
      return
    }
    setBusy(true)
    try {
      const res = await payWithX402(s, '/api/x402/verify-milestone', { milestoneId: milestone.id })
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`)
      toast(res.settlement ? `Oracle paid via x402 · settlement ${res.settlement.transaction?.slice(0, 8)}…` : 'Oracle audit complete', 'ok')
      onChange()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'x402 payment failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const tone = att?.verdict === 'verified' ? 'emerald' : att?.verdict === 'rejected' ? 'coral' : 'amber'

  return (
    <div className="mt-3 rounded-2xl border border-[#ECECED] bg-[#FAFAF9] p-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🤖</span>
          <p className="text-[12px] font-bold">AI Impact Oracle</p>
          {att ? (
            <Pill tone={tone}>
              {att.verdict} · {att.confidence}/100
            </Pill>
          ) : (
            <Pill tone="gray">not audited yet</Pill>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="text-[11px] font-medium text-[#52525B] hover:text-[#111113]">
            {open ? 'Hide evidence' : `Evidence (${ev?.items.length ?? 0})`}
          </button>
          <Btn size="sm" tone="outline" onClick={reverify} loading={busy}>
            {att ? 'Re-verify' : 'Verify'} via x402 · $0.01
          </Btn>
        </div>
      </div>
      {att && (
        <div className="mt-2">
          <p className="text-[11px] text-[#52525B] leading-relaxed">{att.summary}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {att.checks.map((c) => (
              <span key={c.name} title={c.note} className={`text-[10px] px-1.5 py-0.5 rounded-md ${c.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {c.passed ? '✓' : '✗'} {c.name}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[#A1A1AA] mt-2 break-all">
            attestation sha256 <Mono>{att.attestationHash.slice(0, 16)}…</Mono> · model {att.model} · {new Date(att.issuedAt).toLocaleString()}
          </p>
        </div>
      )}
      {open && (
        <div className="mt-3 pt-3 border-t border-[#ECECED]">
          {ev ? (
            <>
              <p className="text-[11px] text-[#111113]">{ev.summary}</p>
              <ul className="mt-2 space-y-1">
                {ev.items.map((i, n) => (
                  <li key={n} className="text-[11px] text-[#52525B] flex gap-2">
                    <Pill tone="gray">{i.kind}</Pill>
                    <span className="min-w-0">
                      {i.url ? (
                        <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline break-all">
                          {i.url.replace(/^https?:\/\//, '')}
                        </a>
                      ) : null}
                      {i.note ? ` — ${i.note}` : ''}
                      {i.lat != null ? ` (${i.lat.toFixed(3)}, ${i.lng?.toFixed(3)})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-[#A1A1AA] mt-2">Submitted by {ev.submittedBy ?? 'unknown'} · {ev.submittedAt ? timeAgo(ev.submittedAt) : ''}</p>
            </>
          ) : (
            <p className="text-[11px] text-[#A1A1AA]">No evidence uploaded for this milestone yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
