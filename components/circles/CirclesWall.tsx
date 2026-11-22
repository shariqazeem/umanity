'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet } from '@/components/shared/ui'
import { apiGet, short } from '@/lib/client/api'

type CircleRow = { number: number; name: string; owner: string; username: string | null; minted: boolean; frozen: boolean; asset: string | null; scene: string | null; at: string }
type Wall = { on: boolean; limit: number; collection?: string; circles: CircleRow[] }

const MARKET = process.env.NEXT_PUBLIC_CIRCLES_MARKET_URL || ''
const pad = (n: number) => String(n).padStart(3, '0')
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

/** The Hundred: the wall of 100 Circles, yours first, and the rules that give them meaning. */
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Season 0 · The Hundred</p>
        <h1 className="text-[28px] md:text-[36px] font-black tracking-[-0.035em] leading-[1.05] mt-1 [text-wrap:balance]">The hundred who gave before there was anything to see.</h1>
        <p className="text-[14px] text-[#86868b] mt-2 max-w-xl [text-wrap:balance]">
          Give $1 or more to the fund and a Circle is minted to your wallet: one of one, numbered in the order people gave, shown to you first. It stays locked until the first film rolls. Then it is yours to keep, or to pass on.
        </p>
      </header>

      <section className="card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          {wall ? (
            <p className="text-[34px] font-black tracking-[-0.03em] counter leading-none">
              {held} <span className="text-[#c7c7cc]">of 100</span>
            </p>
          ) : (
            <div className="skeleton h-[34px] w-32" />
          )}
          <p className="text-[10.5px] text-[#86868b] uppercase tracking-[0.12em] font-medium mt-1.5">Circles held · team not counted</p>
        </div>
        {mine ? (
          <button onClick={() => setOpen(mine.number)} className="btn-primary px-6 py-3 !text-[14px]">
            Your Circle · No. {pad(mine.number)} →
          </button>
        ) : held < 100 ? (
          <button onClick={() => openGive({ fund: true })} className="btn-primary px-6 py-3 !text-[14px]">
            ♡ Give $1 and open yours
          </button>
        ) : (
          <span className="text-[13px] text-[#86868b]">All hundred are held.</span>
        )}
      </section>

      <section className="card p-3 md:p-4">
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 md:gap-2">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
            const c = byNumber.get(n)
            if (c?.minted) {
              return (
                <button key={n} onClick={() => setOpen(n)} className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#f5f5f7] group" aria-label={`Circle No. ${pad(n)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/circles/${n}/image?size=thumb`} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  <span className={`absolute left-1.5 bottom-1 text-[9px] font-bold counter ${c.owner === me ? 'text-emerald-700' : 'text-[#1d1d1f]/70'}`}>{pad(n)}</span>
                </button>
              )
            }
            return (
              <div key={n} className={`relative aspect-[4/5] rounded-xl flex items-center justify-center ${c ? 'bg-[#f5f5f7] animate-pulse' : 'bg-[#fafafa] border border-black/[0.04]'}`} aria-label={c ? `Circle No. ${pad(n)}, being minted` : `Circle No. ${pad(n)}, not yet given`}>
                <span className={`w-1/2 aspect-square rounded-full ${c ? 'bg-[#1d1d1f]/80' : 'border border-black/[0.08]'}`} />
                <span className="absolute left-1.5 bottom-1 text-[9px] font-semibold counter text-[#c7c7cc]">{pad(n)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h3 className="font-bold text-[15px] mb-3">How a Circle works</h3>
        <ul className="space-y-2 text-[13px] text-[#525252]">
          <li className="flex gap-2"><span className="text-emerald-600">●</span> One per wallet, numbered in the order people gave. Team wallets never hold one.</li>
          <li className="flex gap-2"><span className="text-emerald-600">●</span> Each is a one-of-one artwork, revealed to its holder first, minted on Solana.</li>
          <li className="flex gap-2"><span className="text-emerald-600">●</span> Locked until the first film rolls, the moment the first filmed drop pays out. Then the lock is thrown away for good.</li>
          <li className="flex gap-2"><span className="text-emerald-600">●</span> 5% of every resale goes to the giving fund.</li>
          <li className="flex gap-2"><span className="text-[#c7c7cc]">●</span> A record, not an investment. It promises no value and no airdrop.</li>
        </ul>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#aeaeb2]">Season 1</p>
          <p className="text-[15px] font-bold mt-1">The first film</p>
          <p className="text-[12.5px] text-[#86868b] mt-1">Opens when the first filmed drop is delivered.</p>
        </div>
        <div className="card p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#aeaeb2]">After that</p>
          <p className="text-[15px] font-bold mt-1">A season for every milestone</p>
          <p className="text-[12.5px] text-[#86868b] mt-1">Each one only after the thing has happened.</p>
        </div>
      </section>

      <Sheet open={open != null} onClose={() => setOpen(null)} width="md" hideClose>
        {open != null && (
          <div className="p-5">
            {shown?.minted ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/circles/${open}/image`} alt={shown.name} className="w-full aspect-[4/5] object-cover rounded-2xl bg-[#f5f5f7]" />
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">The Hundred · Season 0</p>
                    <span className={`pill !text-[10px] font-semibold whitespace-nowrap ${shown.frozen ? 'bg-[#f5f5f7] text-[#525252]' : 'bg-emerald-50 text-emerald-700'}`}>{shown.frozen ? 'Locked until the first film' : 'Unlocked'}</span>
                  </div>
                  <p className="text-[24px] font-black tracking-[-0.02em] mt-0.5">{shown.name}</p>
                  <p className="text-[12.5px] text-[#86868b] mt-0.5">Held by {shown.username ? `@${shown.username}` : short(shown.owner)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4 text-[12.5px]">
                  {shown.asset && (
                    <a href={`https://solscan.io/account/${shown.asset}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline">
                      On Solana ↗
                    </a>
                  )}
                  {MARKET && !shown.frozen && (
                    <a href={MARKET} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1d1d1f] hover:underline">
                      Marketplace ↗
                    </a>
                  )}
                  <button
                    onClick={() => {
                      const text = `${shown.owner === me ? 'I hold' : 'This is'} ${shown.name}, one of the hundred on @umanity_xyz.\n\n${window.location.origin}/circles?n=${open}`
                      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
                    }}
                    className="font-semibold text-[#1d1d1f] hover:underline"
                  >
                    Share on X
                  </button>
                  <button onClick={() => setOpen(null)} className="ml-auto text-[#86868b] hover:text-[#1d1d1f]">
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-[#1d1d1f] mx-auto" />
                <p className="text-[20px] font-black tracking-[-0.02em] mt-5">Circle No. {pad(open)}</p>
                <p className="text-[13px] text-[#86868b] mt-1.5 max-w-xs mx-auto">{shown ? 'Being minted to its holder. It is revealed to them first.' : `Not given yet. It goes to the ${ordinal(open)} person who gives $1 or more to the fund.`}</p>
                {!shown && held < 100 && (
                  <button onClick={() => (setOpen(null), openGive({ fund: true }))} className="btn-primary px-6 py-3 mt-5 !text-[14px]">
                    ♡ Give $1 and open yours
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
