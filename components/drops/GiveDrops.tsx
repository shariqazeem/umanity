'use client'

import { NextDrop } from '@/components/drops/NextDrop'
import { DropCard } from '@/components/drops/DropParts'
import { pickNextDrop, useDrops } from '@/components/drops/hooks'
import { TokenStrip } from '@/components/trade/TokenStrip'

/** Every drop you can fill, the next one first, then the ones already filled. */
export function GiveDrops() {
  const { data: drops, loading } = useDrops()
  const next = pickNextDrop(drops)
  const open = drops?.filter((d) => d.state === 'open' && !d.refundsOpen && d.id !== next?.id) ?? []
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
          <h3 className="text-[17px] font-bold tracking-tight mb-3">Also filling</h3>
          <div className="space-y-2.5">
            {open.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        </section>
      )}

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
