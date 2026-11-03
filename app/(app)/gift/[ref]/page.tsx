'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Img } from '@/components/shared/ui'
import { useApi } from '@/lib/client/hooks'
import { fmtSol, fmtUsd, short, timeAgo } from '@/lib/client/api'
import { explorerAccount, explorerTx } from '@/lib/solana/constants'
import { chainLabel } from '@/components/feed/types'
import type { GiftJourney, JourneyStep } from '@/lib/data/journey'

const STEP_ICON: Record<JourneyStep['key'], string> = { given: '♡', escrowed: '🔐', delivery: '🚚', verified: '🤖', voted: '🗳️', released: '🔓' }

export default function GiftPage() {
  const { ref } = useParams<{ ref: string }>()
  const { address, solPrice, openGive } = useUmanity()
  const { data, error, loading } = useApi<{ journey?: GiftJourney }>(ref ? `/api/gifts/${encodeURIComponent(ref)}${address ? `?viewer=${address}` : ''}` : null, address)
  const j = data?.journey

  if (loading && !j) {
    return (
      <div className="space-y-3 pt-2">
        <div className="skeleton h-44 !rounded-[20px]" />
        <div className="skeleton h-96 !rounded-[20px]" />
      </div>
    )
  }
  if (!j) {
    return (
      <div className="card p-10 text-center mt-4">
        <p className="text-xl mb-2">🔎</p>
        <p className="font-semibold">{error ?? 'We could not find that gift'}</p>
        <p className="text-[13px] text-[#86868b] mt-1">Gift links use the gift id or its transaction signature.</p>
        <Link href="/home" className="btn-primary px-5 py-2.5 mt-4 !text-[13px]">
          Back to the feed
        </Link>
      </div>
    )
  }

  const usd = solPrice ? j.amountSol * solPrice : null
  const headline = j.route === 'x402' && j.sourceAmount ? `$${j.sourceAmount} USDC` : `${fmtSol(j.amountSol, j.amountSol < 0.1 ? 3 : 2)} SOL`
  const via = j.route === 'intents' ? `from ${chainLabel(j.sourceChain) ?? 'another chain'}` : j.route === 'x402' ? 'by an agent, over x402' : j.route === 'blink' ? 'from a Blink' : 'from a Solana wallet'
  const share = () => {
    const text = `I'm following my gift to ${j.cause.name} on @umanity_xyz: ${j.progress} of 6 steps done, every one of them on-chain. It only leaves escrow once the delivery is proven.\n\n${window.location.origin}/gift/${j.id}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <p className="text-[12px] text-[#86868b]">
          <Link href={`/causes/${j.cause.id}`} className="hover:text-[#1d1d1f]">
            {j.cause.name}
          </Link>{' '}
          / Gift
        </p>
        <button onClick={share} className="btn-secondary h-8 px-3 !text-[12px]">
          Share the journey
        </button>
      </div>

      {/* Summary */}
      <section className="card p-6 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600 mb-3">Follow your gift</p>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[28px] flex-shrink-0">{j.cause.emoji}</div>
            <div className="min-w-0">
              <h1 className="text-[26px] font-black tracking-[-0.03em] leading-tight">
                {headline} <span className="text-[#86868b] font-bold">to</span> {j.cause.name}
              </h1>
              <div className="text-[12px] text-[#86868b] mt-1 flex items-center gap-1.5 flex-wrap">
                {j.donor.username ? (
                  <Link href={`/u/${j.donor.username}`} className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] hover:underline">
                    <Avatar username={j.donor.username} size={18} />@{j.donor.username}
                  </Link>
                ) : (
                  <span className="font-semibold text-[#1d1d1f]">Anonymous</span>
                )}
                <span>·</span>
                <span>{via}</span>
                <span>·</span>
                <span>{timeAgo(j.createdAt)} ago</span>
                {usd != null && j.route !== 'x402' && (
                  <>
                    <span>·</span>
                    <span className="counter">{fmtUsd(usd)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex gap-1.5">
              {j.steps.map((s) => (
                <div key={s.key} className={`h-1.5 flex-1 rounded-full ${s.state === 'done' ? 'bg-emerald-500' : s.state === 'active' ? 'bg-amber-400 animate-pulse' : 'bg-black/[0.06]'}`} />
              ))}
            </div>
            <p className="text-[11px] text-[#86868b] mt-2 counter">
              {j.progress} of {j.steps.length} steps done · {j.steps.find((s) => s.state === 'active')?.title ?? (j.progress === j.steps.length ? 'Delivered, verified and released' : 'Waiting')}
            </p>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="card p-5 md:p-6">
        <ol className="relative">
          {j.steps.map((s, i) => {
            const last = i === j.steps.length - 1
            return (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && <span className={`absolute left-[17px] top-9 bottom-0 w-[2px] ${s.state === 'done' ? 'bg-emerald-200' : 'bg-black/[0.05]'}`} />}
                <span
                  className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-[15px] flex-shrink-0 ${
                    s.state === 'done' ? 'bg-emerald-50 ring-1 ring-emerald-200' : s.state === 'active' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-[#f5f5f7]'
                  }`}
                >
                  <span className={s.state === 'waiting' ? 'opacity-40' : ''}>{STEP_ICON[s.key]}</span>
                  {s.state === 'active' && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[14px] font-semibold ${s.state === 'waiting' ? 'text-[#aeaeb2]' : 'text-[#1d1d1f]'}`}>{s.title}</p>
                    {s.state === 'done' && <span className="text-[10px] font-bold text-emerald-600">✓</span>}
                    {s.at && <span className="text-[10px] text-[#aeaeb2]">{timeAgo(s.at)} ago</span>}
                  </div>
                  <p className={`text-[12.5px] leading-relaxed mt-0.5 ${s.state === 'waiting' ? 'text-[#c7c7cc]' : 'text-[#86868b]'}`}>{s.detail}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {s.tx && (
                      <a href={explorerTx(s.tx)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-emerald-600 hover:underline font-mono">
                        tx {short(s.tx, 6)} ↗
                      </a>
                    )}
                    {s.key === 'escrowed' && (
                      <a href={explorerAccount(j.vault)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-emerald-600 hover:underline font-mono">
                        vault {short(j.vault)} ↗
                      </a>
                    )}
                    {s.link && (
                      <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-emerald-600 hover:underline">
                        {s.link.label} ↗
                      </a>
                    )}
                    {s.key === 'voted' && s.state === 'active' && (
                      <Link href="/govern" className="text-[11px] font-semibold text-amber-700 hover:underline">
                        Cast your vote →
                      </Link>
                    )}
                  </div>
                  {s.key === 'delivery' && j.delivery && j.delivery.media?.some((m) => m.kind === 'photo') && (
                    <Link href={`/causes/${j.cause.id}#proof`} className="grid grid-cols-3 gap-1.5 mt-3 max-w-sm">
                      {j.delivery.media
                        .filter((m) => m.kind === 'photo')
                        .slice(0, 3)
                        .map((m, k) => (
                          <span key={m.url + k} className="aspect-square rounded-xl overflow-hidden bg-black/[0.04] block">
                            <Img src={m.url} alt={m.note || j.delivery!.title} />
                          </span>
                        ))}
                    </Link>
                  )}
                  {s.key === 'delivery' && !j.delivery && j.milestone && j.milestone.thresholdSol > 0 && (
                    <div className="mt-2.5 max-w-sm">
                      <div className="progress emerald">
                        <span style={{ width: `${Math.min(100, (j.milestone.raisedSol / j.milestone.thresholdSol) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button onClick={() => openGive({ causeId: j.cause.id })} className="btn-primary py-3 !text-[13px]">
          ♡ Give again
        </button>
        <Link href={`/home?compose=dare&cause=${j.cause.id}&amount=${j.amountSol}`} className="btn-secondary py-3 !text-[13px]">
          ⚡ Dare a friend to match
        </Link>
        <Link href={`/causes/${j.cause.id}`} className="btn-secondary py-3 !text-[13px]">
          See the cause →
        </Link>
      </section>
    </div>
  )
}
