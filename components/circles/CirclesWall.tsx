'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet } from '@/components/shared/ui'
import { apiGet, short } from '@/lib/client/api'
import { circleSvg, type TallyState } from '@/lib/umanity/tally'

type Rec = { n: number; at: string; gifts: number; state: TallyState }
type CircleRow = { number: number; name: string; owner: string; username: string | null; minted: boolean; frozen: boolean; asset: string | null; record: Rec | null; at: string }
type Wall = { on: boolean; closed?: boolean; limit: number; collection?: string; seasonColour?: string | null; circles: CircleRow[] }

const MARKET = process.env.NEXT_PUBLIC_CIRCLES_MARKET_URL || ''
const pad = (n: number) => String(n).padStart(3, '0')
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const given = (at: string) => {
  const d = new Date(at)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
}

/** A Circle drawn from its record, inline, so the wall needs no images. */
function Drawn({ rec, colour, size }: { rec: Rec; colour?: string | null; size: number }) {
  const held = rec.state === 'closed' && colour ? colour : 'plain'
  return <span className="block w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: circleSvg(rec, { state: rec.state, held }, size, 112) }} />
}

/** An empty place: a dotted circle that waits for its giver. */
function Place({ busy }: { busy?: boolean }) {
  return (
    <svg viewBox="-50 -50 100 100" className={`w-[62%] h-[62%] ${busy ? 'animate-pulse' : ''}`} aria-hidden="true">
      <circle r="40" fill="none" stroke="#111111" strokeWidth={busy ? 5 : 3} strokeDasharray="0.1 8" strokeLinecap="round" opacity={busy ? 1 : 0.55} />
    </svg>
  )
}

/** The Hundred: the wall of 100 Circles, yours first, and the rule that draws them. */
export function CirclesWall() {
  const { signer, openGive } = useUmanity()
  const [wall, setWall] = useState<Wall | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(() => apiGet<Wall>('/api/circles').then(setWall).catch(() => null), [])
  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20_000)
    const n = Number(new URLSearchParams(window.location.search).get('n'))
    if (Number.isInteger(n) && n >= 1 && n <= 100) setOpen(n)
    return () => clearInterval(t)
  }, [load])

  const byNumber = new Map((wall?.circles ?? []).map((c) => [c.number, c]))
  const held = wall?.circles.length ?? 0
  const me = signer?.publicKey.toBase58()
  const mine = wall?.circles.find((c) => c.owner === me) ?? null
  const shown = open != null ? byNumber.get(open) ?? null : null

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em]">Season 0 · The Hundred</p>
        <h1 className="text-[30px] md:text-[40px] font-extrabold tracking-[-0.03em] leading-[1] mt-2 [text-wrap:balance]">The hundred who gave before there was anything to see.</h1>
        <p className="text-[15px] text-[#4F5B5E] mt-3 max-w-xl [text-wrap:pretty]">
          Give $1 or more to the fund and your gift draws your Circle. It is minted to your wallet and shown to you first. It stays open, and locked, until the first film rolls. That day every Circle closes, in the colour of the first film.
        </p>
      </header>

      <section className="card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          {wall ? (
            <p className="text-[38px] font-extrabold tracking-[-0.03em] counter leading-none">
              {held} <span className="text-[#9AA6A9]">of 100</span>
            </p>
          ) : (
            <div className="skeleton h-[38px] w-32" />
          )}
          <p className="font-mono text-[10.5px] text-[#4F5B5E] uppercase tracking-[0.06em] mt-2">Circles held · team not counted</p>
        </div>
        {mine ? (
          <button onClick={() => setOpen(mine.number)} className="btn-primary px-6 py-3 !text-[15px]">
            Your Circle · No. {pad(mine.number)} →
          </button>
        ) : wall?.closed ? (
          <span className="text-[14px] text-[#4F5B5E]">The Hundred closed when the first film rolled.</span>
        ) : held < 100 ? (
          <button onClick={() => openGive({ fund: true })} className="btn-primary px-6 py-3 !text-[15px]">
            Give $1 and draw yours
          </button>
        ) : (
          <span className="text-[14px] text-[#4F5B5E]">All hundred are held.</span>
        )}
      </section>

      <section className="card p-3 md:p-4">
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 md:gap-1.5">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
            const c = byNumber.get(n)
            if (c?.minted && c.record) {
              return (
                <button key={n} onClick={() => setOpen(n)} className={`relative aspect-square rounded-lg bg-white p-1 hover:bg-[#F2F5F5] transition-colors ${c.owner === me ? 'ring-2 ring-[#111111]' : ''}`} aria-label={`Circle No. ${pad(n)}`}>
                  <Drawn rec={c.record} colour={wall?.seasonColour} size={120} />
                  <span className="absolute left-1 bottom-0.5 font-mono text-[8.5px] counter">{pad(n)}</span>
                </button>
              )
            }
            return (
              <button key={n} onClick={() => setOpen(n)} className="relative aspect-square rounded-lg flex items-center justify-center hover:bg-[#F2F5F5] transition-colors" aria-label={c ? `Circle No. ${pad(n)}, being minted` : `Circle No. ${pad(n)}, not given yet`}>
                <Place busy={!!c} />
                <span className="absolute left-1 bottom-0.5 font-mono text-[8.5px] counter text-[#9AA6A9]">{pad(n)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h3 className="font-extrabold text-[18px] mb-3">How a Circle is drawn</h3>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[14px] leading-snug">
          {[
            ['The turn', 'The cut faces the hour you gave, on a 24-hour dial with noon at the top.'],
            ['The strokes', 'Your number in tally strokes: long for ten, short for one.'],
            ['The notches', 'One for every gift you give to the fund, up to nine. Never the amount: a dollar draws the same circle as a thousand.'],
            ['The gap', 'Open, and locked, until the first film rolls. Then every Circle closes and takes the colour of the first film, and the lock is thrown away for good.'],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] font-semibold">{t}</p>
              <p className="text-[#4F5B5E] mt-0.5">{b}</p>
            </div>
          ))}
        </div>
        <ul className="mt-5 pt-4 border-t border-[#111111]/10 space-y-1.5 text-[13.5px] text-[#4F5B5E]">
          <li>One per wallet, numbered in the order people gave. Team wallets never hold one.</li>
          <li>The season closes when the first film rolls, even with fewer than a hundred.</li>
          <li>Anyone can redraw a Circle from its record. 5% of every resale goes to the giving fund.</li>
          <li>A record, not an investment: no token rights, no airdrop and no promise of value.</li>
        </ul>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#4F5B5E]">Season 1</p>
          <p className="text-[17px] font-extrabold mt-1">The first film</p>
          <p className="text-[13px] text-[#4F5B5E] mt-1">Its colour is sampled from the first delivery film. Not chosen. Filmed.</p>
        </div>
        <div className="card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#4F5B5E]">After that</p>
          <p className="text-[17px] font-extrabold mt-1">A season for every milestone</p>
          <p className="text-[13px] text-[#4F5B5E] mt-1">Each one only after the thing has happened.</p>
        </div>
      </section>

      <Sheet open={open != null} onClose={() => setOpen(null)} width="md" hideClose>
        {open != null && (
          <div className="p-5">
            {shown?.minted && shown.record ? (
              <>
                <div className="w-full aspect-square rounded-2xl bg-white border border-[#111111]/10 p-4">
                  <Drawn rec={shown.record} colour={wall?.seasonColour} size={480} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em]">The Hundred · Season 0</p>
                    <span className="pill !text-[10px] font-semibold whitespace-nowrap bg-[#E8EDEE] text-[#111111]">{shown.frozen ? 'Open · locked until the first film' : 'Closed · free to pass on'}</span>
                  </div>
                  <p className="text-[30px] font-extrabold tracking-[-0.02em] mt-1 leading-none">{shown.name}</p>
                  <p className="font-mono text-[11.5px] text-[#4F5B5E] mt-2 leading-relaxed">
                    Given {given(shown.record.at)} · {shown.record.gifts} gift{shown.record.gifts > 1 ? 's' : ''}
                    <br />
                    Held by {shown.username ? `@${shown.username}` : short(shown.owner)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4 text-[13px]">
                  {shown.asset && (
                    <a href={`https://solscan.io/account/${shown.asset}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">
                      On Solana ↗
                    </a>
                  )}
                  {MARKET && !shown.frozen && (
                    <a href={MARKET} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">
                      Marketplace ↗
                    </a>
                  )}
                  <button
                    onClick={() => {
                      const text = `${shown.owner === me ? 'My gift drew' : 'This is'} ${shown.name}, one of the hundred on @umanity_xyz.\n\n${window.location.origin}/circles?n=${open}`
                      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
                    }}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    Share on X
                  </button>
                  <button onClick={() => setOpen(null)} className="ml-auto text-[#4F5B5E] hover:text-[#111111]">
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-24 h-24 mx-auto flex items-center justify-center">
                  <Place busy={!!shown} />
                </div>
                <p className="text-[24px] font-extrabold tracking-[-0.02em] mt-4">Circle No. {pad(open)}</p>
                <p className="text-[14px] text-[#4F5B5E] mt-1.5 max-w-xs mx-auto">{shown ? 'Being minted to its holder. It is shown to them first.' : wall?.closed ? 'Never drawn. The Hundred closed when the first film rolled.' : `Not given yet. It is drawn by the ${ordinal(open)} gift of $1 or more to the fund.`}</p>
                {!shown && !wall?.closed && held < 100 && (
                  <button onClick={() => (setOpen(null), openGive({ fund: true }))} className="btn-primary px-6 py-3 mt-5 !text-[15px]">
                    Give $1 and draw yours
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
