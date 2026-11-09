'use client'

import { NextDrop } from '@/components/drops/NextDrop'
import Link from 'next/link'
import { DropCard } from '@/components/drops/DropParts'
import { pickNextDrop, useDrops } from '@/components/drops/hooks'
import { TokenStrip } from '@/components/trade/TokenStrip'

/** Every drop you can fill, the next one first, then the ones already filled. */
export function GiveDrops() {
  const { data: drops, loading } = useDrops()
  const next = pickNextDrop(drops)
  const filling = drops?.filter((d) => d.state === 'open' && !d.refundsOpen && d.id !== next?.id) ?? []
  const open = filling.filter((d) => d.official)
  const community = filling.filter((d) => !d.official)
  const done = drops?.filter((d) => d.state !== 'open' || d.refundsOpen) ?? []

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Fill a drop</h2>
        <p className="text-[#86868b] text-sm">Each drop is one real delivery. It pays out only on filmed proof.</p>
      </section>

      <NextDrop />
      <TokenStrip />

      {!loading && drops && drops.length === 0 && (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-3 text-xl">🍲</div>
          <p className="font-semibold text-[15px]">The first drop opens soon</p>
          <p className="text-[13px] text-[#86868b] mt-1 max-w-sm mx-auto">Each drop lists what it buys, where it goes and the date it must be delivered by.</p>
        </div>
      )}

      {open.length > 0 && (
        <section>
          <h3 className="text-[17px] font-bold tracking-tight mb-3">More Umanity drops</h3>
          <div className="space-y-2.5">
            {open.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="text-[17px] font-bold tracking-tight">Community drops</h3>
            <p className="text-[12.5px] text-[#86868b]">Run by people where they live. Same rules: paid only after filmed proof, refunded if late.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {community.map((d) => (
            <DropCard key={d.id} drop={d} />
          ))}
          <Link href="/start" className="card-interactive p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">＋</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Run a drop where you live</span>
              <span className="block text-[12px] text-[#86868b]">Propose it, deliver it, film it. You&apos;re paid from its pot after the proof.</span>
            </span>
            <span className="text-[12.5px] font-semibold text-[#1d1d1f]">Start →</span>
          </Link>
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h3 className="text-[17px] font-bold tracking-tight mb-3">Past drops</h3>
          <div className="space-y-2.5">
            {done.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
