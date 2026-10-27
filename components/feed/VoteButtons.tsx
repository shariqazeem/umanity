'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon, Spinner } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import type { ProposalView } from '@/lib/data/governance'

/** Approve / not-yet bars for a release vote. Shows results after voting or once the vote closed. */
export function VoteButtons({ proposal, myVote, onVoted, compact }: { proposal: ProposalView; myVote?: number | null; onVoted?: (option: number) => void; compact?: boolean }) {
  const { address, ensureSigner, toast } = useUmanity()
  const [vote, setVote] = useState<number | null>(myVote ?? null)
  const [busy, setBusy] = useState<number | null>(null)
  const [results, setResults] = useState(proposal.results)
  const closed = proposal.status !== 'active' || new Date(proposal.closes_at) < new Date()
  const yes = results[0]
  const no = results[1]
  const decided = vote !== null || closed

  const cast = async (option: number) => {
    const s = ensureSigner()
    if (!s) return
    setBusy(option)
    try {
      const r = await apiSend<{ success: boolean; error?: string; voteWeight?: number }>('/api/governance/vote', { proposalId: proposal.id, voterAddress: address ?? s.publicKey.toBase58(), voteOption: option })
      if (!r.success) throw new Error(r.error || 'Vote failed')
      setVote(option)
      setResults((rs) => rs.map((x, i) => (i === option ? { ...x, voteCount: x.voteCount + 1, totalWeight: x.totalWeight + (r.voteWeight ?? 0) } : x)))
      toast(r.voteWeight ? `Counted with ${r.voteWeight.toLocaleString()} voting power.` : 'Vote counted.', 'ok')
      onVoted?.(option)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Vote failed'
      toast(/point|power|donat|give/i.test(msg) ? 'Only people who have given can vote. Give once to unlock it.' : msg, 'err')
    } finally {
      setBusy(null)
    }
  }

  const total = (yes?.totalWeight ?? 0) + (no?.totalWeight ?? 0)
  const pct = (r?: { totalWeight: number }) => (total > 0 && r ? Math.round((r.totalWeight / total) * 100) : 0)

  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? '' : 'mt-1'}`}>
      {[yes, no].map((r, i) =>
        r ? (
          <button
            key={i}
            onClick={() => cast(i)}
            disabled={decided || busy !== null}
            className={`relative overflow-hidden rounded-2xl border text-left transition-all disabled:cursor-default ${compact ? 'px-3 py-2' : 'px-3.5 py-3'} ${vote === i ? 'border-[#1d1d1f]' : decided ? 'border-black/[0.06]' : i === 0 ? 'border-[#10b981]/40 hover:border-[#10b981]' : 'border-black/[0.08] hover:border-black/30'}`}
          >
            {decided && <span className={`absolute inset-0 ${i === 0 ? 'bg-[#ecfdf5]' : 'bg-black/[0.04]'}`} style={{ width: `${pct(r)}%` }} />}
            <span className="relative flex items-center justify-between gap-2">
              <span className={`text-[13px] font-semibold inline-flex items-center gap-1.5 ${i === 0 ? 'text-[#047857]' : 'text-[#1d1d1f]'}`}>
                {busy === i ? <Spinner className="!w-3.5 !h-3.5" /> : <Icon name={i === 0 ? 'check' : 'clock'} size={14} />}
                {i === 0 ? 'Approve release' : 'Not yet'}
              </span>
              {decided && <span className="text-[12.5px] font-semibold num">{pct(r)}%</span>}
            </span>
            {!compact && (
              <span className="relative block text-[11px] text-[#6e6e73] mt-0.5 num">
                {r.voteCount} {r.voteCount === 1 ? 'vote' : 'votes'}
                {vote === i ? ' · yours' : ''}
              </span>
            )}
          </button>
        ) : null
      )}
    </div>
  )
}
