'use client'

import { useEffect, useState } from 'react'
import type { DropDetail } from '@/lib/umanity/data'

type Guard = NonNullable<DropDetail['guard']>

/** The time, once mounted: the server and the browser disagree on the clock and the time zone, so times render client-side only. */
function useNow(everyMs: number) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

function timeLeft(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const modelName = (id: string) => (id.split('/').pop() ?? id).replace(/-A\d+B-Instruct$/, '')

const DOT = { good: 'bg-emerald-500', bad: 'bg-red-500', held: 'bg-amber-500', open: 'border border-black/25' }

function Row({ dot, label, children }: { dot: keyof typeof DOT; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2.5">
      <span className={`w-2 h-2 rounded-full shrink-0 translate-y-[-1px] ${DOT[dot]}`} />
      <span className="min-w-0">
        <span className="font-semibold">{label}</span> <span className="text-[#86868b]">{children}</span>
      </span>
    </li>
  )
}

/** The NEAR guard's say on the current proof: the AI's verdict, the council's window, the release. */
export function GuardCard({ guard, unlocked }: { guard: Guard; unlocked: boolean }) {
  const now = useNow(30_000)
  const v = guard.verdict
  const near = guard.network === 'mainnet' ? 'NEAR' : 'NEAR testnet'
  const reviewEnds = v ? new Date(v.reviewEndsAt).getTime() : 0
  const reviewOpen = v ? (now ?? Date.parse(v.at)) < reviewEnds : false

  const head = !v
    ? { text: 'Checking the proof', tone: 'text-[#1d1d1f]' }
    : !v.approve
      ? { text: 'Not approved by the AI check', tone: 'text-red-600' }
      : v.vetoedBy
        ? { text: 'Vetoed by the council', tone: 'text-amber-700' }
        : { text: unlocked ? 'Approved and released' : 'Approved by the AI check', tone: 'text-emerald-700' }

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-bold text-[15px] ${head.tone}`}>
            {v?.approve && !v.vetoedBy && '✓ '}
            {head.text}
          </p>
          <p className="text-[11.5px] text-[#86868b] mt-0.5">
            {v ? `${modelName(v.model)} compared the proof with the promise in a sealed machine; ${near} checked its signature.` : `An AI compares the proof with the promise in a sealed machine. Its signed verdict lands on ${near} in about a minute.`}
          </p>
        </div>
        <a href={guard.contractUrl} target="_blank" rel="noopener noreferrer" className="hit shrink-0 text-[11.5px] font-semibold text-[#86868b] hover:text-[#1d1d1f]">
          Guard ↗
        </a>
      </div>

      {v?.reason && <p className="mt-3 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[13px] leading-snug">“{v.reason}”</p>}

      {v && (
        <ol className="mt-3 space-y-2 text-[12.5px]">
          <Row dot={v.approve ? 'good' : 'bad'} label="AI check">
            {v.approve ? 'Approved' : 'Not approved'}
            {now !== null && ` at ${clock(v.at)}`}
            {guard.verdictTxUrl && (
              <>
                {' · '}
                <a href={guard.verdictTxUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  verdict ↗
                </a>
              </>
            )}
          </Row>
          {v.approve && (
            <Row dot={v.vetoedBy ? 'held' : reviewOpen ? 'open' : 'good'} label="Council review">
              {v.vetoedBy ? `Vetoed by ${v.vetoedBy}. A new proof needs a new check.` : reviewOpen ? `Open${now !== null ? ` for ${timeLeft(reviewEnds - now)} more` : ''}; the council can still veto.` : 'Closed with no veto.'}
            </Row>
          )}
          {v.approve && !v.vetoedBy && (
            <Row dot={unlocked ? 'good' : 'open'} label="Release">
              {unlocked ? (
                <>
                  NEAR&apos;s MPC network signed the unlock
                  {guard.releaseTxUrl && (
                    <>
                      {' · '}
                      <a href={guard.releaseTxUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        signature ↗
                      </a>
                    </>
                  )}
                </>
              ) : reviewOpen ? (
                'After the review, NEAR’s MPC network signs the unlock.'
              ) : (
                'Ready. NEAR’s MPC network signs the unlock next.'
              )}
            </Row>
          )}
          {!v.approve && <Row dot="open" label="What now">The pot stays locked. The team can post a clearer proof; if the date passes, every backer is refunded.</Row>}
        </ol>
      )}
    </article>
  )
}
