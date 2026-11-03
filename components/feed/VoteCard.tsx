'use client'

import Link from 'next/link'
import { countdown, fmtSol } from '@/lib/client/api'
import { useCountdown } from '@/lib/client/hooks'
import { getCause } from '@/lib/causes'
import type { ProposalView } from '@/lib/data/governance'
import { VoteButtons } from './VoteButtons'

/** A live release vote in the original council-card style. */
export function VoteCard({ proposal }: { proposal: ProposalView }) {
  const secs = Math.max(0, Math.round((new Date(proposal.closes_at).getTime() - Date.now()) / 1000))
  const left = useCountdown(secs)
  const closed = proposal.status !== 'active' || left <= 0
  const poolId = proposal.recipient?.pool_id
  const cause = poolId ? getCause(poolId) : undefined
  return (
    <article className="council-card p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-lg flex-shrink-0">{cause?.emoji ?? '🗳️'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{proposal.poolName || 'Release vote'}</p>
          <p className="text-[10px] text-[#aeaeb2] counter">{closed ? 'Vote closed' : `Closes in ${countdown(left)}`}</p>
        </div>
        <span className={`pill !text-[9px] font-semibold ${closed ? 'bg-black/[0.04] text-[#86868b]' : 'bg-amber-50 text-amber-700'}`}>
          {!closed && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
          {closed ? (proposal.status === 'executed' ? (proposal.result?.approved ? 'Passed' : 'Declined') : 'Closed') : 'Release vote'}
        </span>
      </div>
      <h3 className="text-[14px] font-semibold leading-snug">{proposal.title}</h3>
      {proposal.description && <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">{proposal.description}</p>}
      {proposal.escrowAmount > 0 && (
        <p className="text-[11px] text-[#86868b] mt-2">
          <span className="font-bold text-[#1d1d1f] counter">{fmtSol(proposal.escrowAmount, 3)} SOL</span> held in escrow on the line
        </p>
      )}
      <div className="mt-3">
        <VoteButtons proposal={proposal} compact />
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px] text-[#aeaeb2]">
        <span className="counter">
          {proposal.totalVoters} {proposal.totalVoters === 1 ? 'voter' : 'voters'}
        </span>
        <Link href={poolId ? `/causes/${poolId}#proof` : '/govern'} className="font-semibold text-emerald-600 hover:underline">
          Review the evidence →
        </Link>
      </div>
    </article>
  )
}
