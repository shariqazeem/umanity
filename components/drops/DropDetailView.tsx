'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { useDrop } from '@/components/drops/hooks'
import { Backers, ChainFacts, DropMeter, DropSteps, MoneyRules, StatePill, dayText, dropHref, whenText } from '@/components/drops/DropParts'
import { GuardCard } from '@/components/drops/GuardCard'
import { listTotal, plural, usdText } from '@/lib/umanity/drops'
import { explorerTx } from '@/lib/solana/constants'

/** One drop: its pot, steps, list, proof, backers and on-chain facts. */
export function DropDetailView() {
  const { id: param } = useParams<{ id: string }>()
  const n = Number(param)
  const id = Number.isInteger(n) && n >= 1 ? n - 1 : null
  const { data: drop, loading, error } = useDrop(id)
  const { openGive } = useUmanity()
  // The page renders on the server too, where there is no document.body to portal the Give bar into.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (id == null || (!loading && !drop)) {
    return (
      <div className="card p-10 text-center mt-4">
        <p className="font-semibold">{error === 'Unknown drop' || id == null ? 'There is no drop with that number' : 'This drop could not be loaded'}</p>
        <Link href="/home" className="btn-primary px-5 py-2.5 mt-4 !text-[13px]">
          See the latest drop
        </Link>
      </div>
    )
  }
  if (!drop) return <div className="space-y-3 pt-2"><div className="skeleton h-72" /><div className="skeleton h-40" /></div>

  const giving = drop.state === 'open' && !drop.refundsOpen
  const give = () => openGive({ dropId: drop.id })
  const share = () => {
    const text = `${drop.title}, ${drop.place}. ${usdText(drop.potUsd)} of ${usdText(drop.goalUsd)} so far on @umanity_xyz. It pays out only once the delivery is filmed and checked.\n\n${window.location.origin}${dropHref(drop.id)}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const proof = drop.updates.filter((u) => u.kind === 'proof')
  const updates = drop.updates.filter((u) => u.kind !== 'proof')

  return (
    <div className="space-y-5 pb-16 lg:pb-0">
      <div className="flex items-center justify-between gap-3 pt-1">
        <nav className="text-[12px] text-[#86868b] flex items-center gap-1.5 min-w-0">
          <Link href="/home" className="hover:text-[#1d1d1f]">
            Drops
          </Link>
          <span>/</span>
          <span className="text-[#1d1d1f] font-medium truncate">Drop #{drop.id + 1}</span>
        </nav>
        <button onClick={share} className="btn-secondary h-8 px-3 !text-[12px]">
          Share
        </button>
      </div>

      <section className="card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="w-16 h-16 rounded-[22px] bg-[#f5f5f7] flex items-center justify-center text-[32px] flex-shrink-0">{drop.emoji}</div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <StatePill drop={drop} />
              <span className="pill bg-black/[0.04] text-[#525252] !text-[10px]">📍 {drop.place}</span>
              <span className="pill bg-black/[0.04] text-[#525252] !text-[10px]">🗓 {dayText(drop.deadline)}</span>
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600 mt-5">Drop #{drop.id + 1}</p>
          <h1 className="text-[30px] md:text-[38px] font-black tracking-[-0.035em] leading-[1.02] mt-1">{drop.title}</h1>
          {drop.story && <p className="text-[14.5px] text-[#525252] mt-3 leading-relaxed max-w-xl">{drop.story}</p>}

          <div className="mt-6 pt-5 border-t border-black/[0.04]">
            <DropMeter drop={drop} />
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {giving ? (
              <button onClick={give} className="btn-primary px-6 py-3 !text-[14px]">
                ♡ Give to this drop
              </button>
            ) : (
              <span className="text-[13px] text-[#86868b] py-3">This drop has stopped taking gifts.</span>
            )}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="font-bold text-[15px] mb-4">Where it stands</h3>
        <DropSteps drop={drop} reviewHours={drop.reviewHours} />
      </section>

      <section className="card p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-bold text-[15px]">What the pot buys</h3>
            <p className="text-[11.5px] text-[#86868b]">
              One {drop.unit.name} costs {usdText(drop.unit.usd)} and covers {drop.unit.covers}.
            </p>
          </div>
        </div>
        <ul className="divide-y divide-black/[0.04]">
          {drop.items.map((it) => (
            <li key={it.name} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="flex-1 min-w-0">
                <span className="font-semibold">{it.name}</span>
                {it.covers && <span className="text-[#86868b]"> · {it.covers}</span>}
              </span>
              <span className="text-[#86868b] counter">
                {it.qty} × {usdText(it.unitUsd)}
              </span>
              <span className="font-bold counter w-20 text-right">{usdText(it.qty * it.unitUsd)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between pt-3 text-[13px]">
            <span className="font-semibold">Total</span>
            <span className="font-black counter">{usdText(listTotal(drop.items))}</span>
          </li>
        </ul>
      </section>

      <section id="proof" className="scroll-mt-20">
        <h3 className="text-[17px] font-bold tracking-tight mb-1">Proof</h3>
        <p className="text-[12px] text-[#86868b] mb-3">The delivery video, photos and receipts. Their hash is posted on-chain before the pot can pay out.</p>
        {proof.length ? (
          <div className="space-y-3">
            {proof.map((u) => (
              <ProofCard key={u.id} update={u} />
            ))}
            {drop.guard && <GuardCard guard={drop.guard} unlocked={drop.state === 'unlocked'} />}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-xl">🎥</div>
            {drop.refundsOpen ? (
              <>
                <p className="font-semibold text-[15px]">{drop.state === 'cancelled' ? 'Called off before delivery' : 'Not delivered in time'}</p>
                <p className="text-[13px] text-[#86868b] mt-1 max-w-sm mx-auto">No proof was posted, so the pot can never pay out. Every backer gets back what they gave.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[15px]">Not delivered yet</p>
                <p className="text-[13px] text-[#86868b] mt-1 max-w-sm mx-auto">
                  When the team hands out {drop.unit.name}s in {drop.place}, the video and receipts land here. Due by {whenText(drop.deadline)}.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {updates.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[17px] font-bold tracking-tight">Updates</h3>
          {updates.map((u) => (
            <ProofCard key={u.id} update={u} />
          ))}
        </section>
      )}

      <section className="card p-5">
        <h3 className="font-bold text-[15px] mb-1">Backers</h3>
        <p className="text-[11.5px] text-[#86868b] mb-2">{drop.backers ? `${plural(drop.backers, 'backer')}. Names go in the delivery video's credits.` : 'Names go in the delivery video credits.'}</p>
        <Backers gifts={drop.gifts} />
      </section>

      <section className="card p-5">
        <h3 className="font-bold text-[15px] mb-3">How your money is handled</h3>
        <MoneyRules drop={drop} reviewHours={drop.reviewHours} />
      </section>

      <section className="card p-5">
        <h3 className="font-bold text-[15px] mb-1">On-chain</h3>
        <ChainFacts drop={drop} />
      </section>

      {/* Portaled: the page's entrance animation leaves a transform that would pin a fixed bar to the page instead of the screen. */}
      {giving &&
        mounted &&
        createPortal(
          <div className="lg:hidden fixed left-0 right-0 bottom-[56px] z-40 px-4 pb-3 pt-2 bg-gradient-to-t from-white via-white/95 to-white/0 safe-area-bottom">
            <button onClick={give} className="btn-primary w-full py-3.5 !text-[14px] shadow-lg shadow-black/10">
              ♡ Give · {usdText(drop.potUsd)} of {usdText(drop.goalUsd)}
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

function ProofCard({ update }: { update: { id: string; title: string; body: string; media: { url: string; kind: string; note?: string }[]; proofHash: string | null; proofTx: string | null; proofCheck?: string | null; xPostUrl: string | null; at: string } }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[14.5px]">{update.title}</p>
        <p className="text-[11px] text-[#86868b]">{new Date(update.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
      </div>
      {update.body && <p className="text-[13.5px] text-[#525252] mt-1.5 leading-relaxed">{update.body}</p>}
      {update.media.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {update.media.map((m) =>
            m.kind === 'video' ? (
              <video key={m.url} src={m.url} controls playsInline className="col-span-2 w-full rounded-2xl bg-black" />
            ) : (
              <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.note || m.kind} className="w-full aspect-[4/3] object-cover rounded-2xl bg-[#f5f5f7]" />
              </a>
            ),
          )}
        </div>
      )}
      {(update.proofHash || update.xPostUrl) && (
        <p className="text-[11px] text-[#86868b] mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {update.proofHash && <span className="font-mono">proof {update.proofHash.slice(0, 12)}…</span>}
          {update.proofCheck === 'on-chain' && <span className="text-emerald-700 font-semibold">✓ matches the hash on-chain</span>}
          {update.proofCheck === 'superseded' && <span>replaced by a newer proof</span>}
          {update.proofCheck === 'mismatch' && <span className="text-red-600 font-semibold">✗ does not match its hash</span>}
          {update.proofTx && (
            <a href={explorerTx(update.proofTx)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold hover:underline">
              posted on-chain ↗
            </a>
          )}
          {update.xPostUrl && (
            <a href={update.xPostUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              on X ↗
            </a>
          )}
        </p>
      )}
    </article>
  )
}
