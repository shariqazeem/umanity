'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { fmtSol, fmtUsd } from '@/lib/client/api'
import { getCause, milestoneWhat } from '@/lib/causes'
import { useCauseDetail, useIsAdmin, useVoting, nextMilestoneFor } from '@/components/causes/data'
import { UpdateCard } from '@/components/causes/UpdateCard'
import { GiveCard, EscrowBox } from '@/components/causes/GiveCard'
import { Supporters, GiftsList, DaresList } from '@/components/causes/People'
import { blinkUrl } from '@/components/causes/CauseCard'

export default function CausePage() {
  const { id } = useParams<{ id: string }>()
  const { address, openGive, solPrice, user } = useUmanity()
  const { detail, loading, notFound, reload } = useCauseDetail(id, address)
  const voting = useVoting(address)
  const isAdmin = useIsAdmin(address)
  const [copied, setCopied] = useState(false)
  const meta = id ? getCause(id) : undefined

  if (notFound || (!loading && !detail && !meta)) {
    return (
      <div className="card p-10 text-center mt-4">
        <p className="font-semibold">We could not find that cause</p>
        <Link href="/explore" className="btn-primary px-5 py-2.5 mt-4 !text-[13px]">
          See all causes
        </Link>
      </div>
    )
  }

  const cause = detail?.pool ?? meta
  if (!cause) return <div className="skeleton h-80 mt-4" />

  const refresh = () => {
    reload()
    voting.reload()
  }
  const share = () => {
    const text = `${cause.name} on @umanity_xyz: ${cause.impact} Gifts wait in escrow on Solana until the delivery is proven.\n\n${window.location.origin}/causes/${cause.id}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const fundedByViewer = !!user && (detail?.supporters.some((s) => s.address === address) || detail?.gifts.some((g) => g.address === address)) === true
  const held = detail?.heldSol ?? 0
  const raised = detail?.raisedSol ?? 0
  const next = nextMilestoneFor(detail?.campaign ?? null)
  const pct = next && next.thresholdSol > 0 ? Math.min(100, (raised / next.thresholdSol) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 pt-1">
        <nav className="text-[12px] text-[#86868b] flex items-center gap-1.5 min-w-0">
          <Link href="/explore" className="hover:text-[#1d1d1f]">
            Explore
          </Link>
          <span>/</span>
          <span className="text-[#1d1d1f] font-medium truncate">{cause.name}</span>
        </nav>
        <button onClick={share} className="btn-secondary h-8 px-3 !text-[12px]">
          Share
        </button>
      </div>

      {/* Hero */}
      <section className="card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="w-16 h-16 rounded-[22px] bg-[#f5f5f7] flex items-center justify-center text-[32px] flex-shrink-0">{cause.emoji}</div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <span className="pill bg-black/[0.04] text-[#525252] !text-[10px]">{cause.category}</span>
              {cause.location && <span className="pill bg-black/[0.04] text-[#525252] !text-[10px]">📍 {cause.location}</span>}
              {cause.deliveryMode === 'field' && <span className="pill bg-emerald-50 text-emerald-700 !text-[10px] font-semibold">🚚 Delivered by hand</span>}
            </div>
          </div>
          <h1 className="text-[30px] md:text-[38px] font-black tracking-[-0.035em] leading-[1.02] mt-5">{cause.name}</h1>
          <p className="text-[15px] text-[#86868b] mt-2 leading-relaxed max-w-lg">{cause.tagline}</p>
          {cause.impact && <p className="text-[13px] font-semibold text-emerald-600 mt-3">{cause.impact}</p>}

          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-black/[0.04]">
            {(
              [
                ['In escrow', held],
                ['Raised', raised],
                ['Released', detail?.releasedSol ?? 0],
              ] as const
            ).map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{l}</p>
                {loading ? <div className="skeleton h-7 w-16 mt-1" /> : <p className="text-[22px] md:text-[26px] font-bold counter leading-tight mt-0.5">{fmtSol(v, 2)}</p>}
                <p className="text-[10.5px] text-[#aeaeb2] counter">SOL{solPrice && !loading ? ` · ${fmtUsd(v * solPrice)}` : ''}</p>
              </div>
            ))}
          </div>

          {next && (
            <div className="mt-4">
              <div className="progress emerald">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-[#86868b] mt-1.5">
                <span className="font-semibold text-[#1d1d1f] counter">{fmtSol(raised, 2)}</span> / <span className="counter">{fmtSol(next.thresholdSol, next.thresholdSol >= 10 ? 0 : 2)}</span> SOL unlocks delivery #{next.index + 1}: {milestoneWhat(next.description)}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={() => openGive({ causeId: cause.id })} className="btn-primary px-5 py-3 !text-[13px]">
              ♡ Give
            </button>
            <button onClick={() => openGive({ causeId: cause.id, method: 'anychain' })} className="btn-secondary px-4 py-3 !text-[13px]">
              🌐 From another chain
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(blinkUrl(cause.id)).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }
              className="btn-ghost px-3 py-3 !text-[13px]"
            >
              {copied ? '✓ Blink copied' : '⚡ Copy Blink for X'}
            </button>
          </div>
        </div>
      </section>

      {/* What it buys */}
      {cause.units.length > 0 && (
        <section className="card p-5">
          <h3 className="font-bold text-[15px] mb-0.5">What your gift buys</h3>
          <p className="text-[11px] text-[#86868b] mb-3">Prices from our last purchases; they move with the market.</p>
          <ul className="divide-y divide-black/[0.04]">
            {cause.units.map((u) => (
              <li key={u.label} className="flex items-center gap-4 py-2.5">
                <span className="text-[16px] font-bold counter w-14 flex-shrink-0">${u.usd % 1 === 0 ? u.usd : u.usd.toFixed(2)}</span>
                <span className="text-[13px] flex-1">one {u.label}</span>
                <button onClick={() => openGive({ causeId: cause.id, amountUsd: u.usd })} className="text-[12px] font-semibold text-emerald-600 hover:underline">
                  Give this →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Escrow plan */}
      <EscrowBox held={held} raised={raised} released={detail?.releasedSol ?? 0} vault={detail?.vault.address ?? ''} poolPda={detail?.vault.poolPda ?? ''} campaign={detail?.campaign ?? null} />

      {/* Proof */}
      <section id="proof" className="scroll-mt-20">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="text-[17px] font-bold tracking-tight">Delivery proof</h3>
            <p className="text-[12px] text-[#86868b]">Photos, receipts, the oracle&apos;s audit and the donors&apos; vote.</p>
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-48" />
        ) : detail && detail.updates.length > 0 ? (
          <div className="space-y-3">
            {detail.updates.map((u) => (
              <UpdateCard key={u.id} update={u} isAdmin={isAdmin} myVote={u.proposal ? voting.myVotes[u.proposal.id] ?? null : null} power={voting.power} onVote={voting.vote} onExecute={voting.execute} onChange={refresh} fundedByViewer={fundedByViewer} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-xl">📷</div>
            <p className="font-semibold text-[15px]">The first delivery is being funded</p>
            <p className="text-[13px] text-[#86868b] mt-1 max-w-sm mx-auto">When the team delivers, the photos and receipts land here and the donors vote on the release.{held > 0 ? ` ${fmtSol(held, 2)} SOL is already waiting in the vault.` : ''}</p>
            <button onClick={() => openGive({ causeId: cause.id })} className="btn-primary px-5 py-2.5 mt-4 !text-[13px]">
              ♡ Help fund it
            </button>
          </div>
        )}
      </section>

      {/* Story */}
      <section className="card p-5">
        <h3 className="font-bold text-[15px] mb-2">The story</h3>
        <p className="text-[14px] leading-[1.7] text-[#525252]">{cause.story}</p>
      </section>

      <GiveCard cause={cause} />

      <section>
        <h3 className="text-[17px] font-bold tracking-tight mb-3">Supporters</h3>
        {loading ? <div className="skeleton h-24" /> : <Supporters supporters={detail?.supporters ?? []} count={detail?.supporterCount ?? 0} friends={detail?.friendsWhoGave ?? []} onGive={() => openGive({ causeId: cause.id })} />}
      </section>

      {detail && detail.gifts.length > 0 && (
        <section>
          <h3 className="text-[17px] font-bold tracking-tight mb-3">Recent gifts</h3>
          <GiftsList gifts={detail.gifts} />
        </section>
      )}

      {detail && detail.dares.length > 0 && (
        <section>
          <h3 className="text-[17px] font-bold tracking-tight mb-1">Open dares</h3>
          <p className="text-[12px] text-[#86868b] mb-3">Friends daring friends to give. The cause wins either way.</p>
          <DaresList dares={detail.dares} />
        </section>
      )}
    </div>
  )
}
