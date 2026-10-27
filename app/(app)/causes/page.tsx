'use client'

import { useState } from 'react'
import { CAUSES } from '@/lib/causes'
import { CauseCard, CauseCardSkeleton } from '@/components/causes/CauseCard'
import { useCauseList } from '@/components/causes/data'

export default function CausesPage() {
  const { items } = useCauseList()
  const [cat, setCat] = useState('All')
  const cats = ['All', ...Array.from(new Set(CAUSES.map((c) => c.category)))]
  const list = (items ?? []).filter((c) => cat === 'All' || c.category === cat)

  return (
    <div className="max-w-[1120px] mx-auto">
      <div className="max-w-[640px] animate-fade-up">
        <p className="eyebrow mb-3">The causes</p>
        <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02] tracking-[-0.01em]">Six things we deliver by hand.</h1>
        <p className="text-[16px] text-[#6e6e73] mt-4 leading-relaxed">Each cause has its own vault on Solana, its own delivery log and its own receipts. Pick the one that moves you.</p>
      </div>

      <div className="flex gap-1.5 flex-wrap mt-8">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`h-9 px-4 rounded-full text-[13px] font-semibold transition-all ${cat === c ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-black/[0.08] text-[#6e6e73] hover:text-[#1d1d1f] hover:border-black/30'}`}>
            {c}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CauseCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8 animate-stagger">
          {list.map((c) => (
            <CauseCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}
