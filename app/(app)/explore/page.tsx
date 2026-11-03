'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Icon } from '@/components/shared/ui'
import { CauseCard, CauseCardSkeleton } from '@/components/causes/CauseCard'
import { useCauseList } from '@/components/causes/data'
import { apiGet, fmtSol } from '@/lib/client/api'
import { CAUSES } from '@/lib/causes'
import type { PublicUser } from '@/lib/data/users'

export default function ExplorePage() {
  const { items } = useCauseList()
  const { address } = useUmanity()
  const [cat, setCat] = useState('All')
  const [people, setPeople] = useState<PublicUser[] | null>(null)
  const cats = ['All', ...Array.from(new Set(CAUSES.map((c) => c.category)))]
  const list = (items ?? []).filter((c) => cat === 'All' || c.category === cat)

  useEffect(() => {
    apiGet<{ profiles?: PublicUser[] }>(`/api/social/suggested?limit=6${address ? `&address=${address}` : ''}`)
      .then((d) => setPeople(d.profiles ?? []))
      .catch(() => setPeople([]))
  }, [address])

  return (
    <div>
      <section className="pt-2 mb-5">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Explore</h2>
        <p className="text-[#86868b] text-sm">Causes, impact makers, and the proof behind every gift.</p>
      </section>

      <PeopleSearch />

      <section className="mt-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="text-[17px] font-bold tracking-tight">Causes</h3>
            <p className="text-[12px] text-[#86868b]">Each one is its own escrow vault on Solana, delivered by hand in Pakistan.</p>
          </div>
          <span className="text-[11px] text-[#aeaeb2] font-medium whitespace-nowrap flex-shrink-0 ml-3">{CAUSES.length} active</span>
        </div>
        <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${cat === c ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-stagger">{items === null ? [1, 2, 3, 4].map((i) => <CauseCardSkeleton key={i} />) : list.map((c) => <CauseCard key={c.id} c={c} />)}</div>
      </section>

      <section className="mt-8">
        <h3 className="text-[17px] font-bold tracking-tight mb-3">Impact makers</h3>
        {people === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-[#86868b]">The first people to give will show up here.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {people.map((u) => (
              <Link key={u.address} href={`/u/${u.username}`} className="card-interactive p-3.5 flex items-center gap-3">
                <Avatar username={u.username} url={u.avatarUrl} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">@{u.username}</p>
                  <p className="text-[11px] text-[#86868b] truncate">{u.bio || (u.totalDonated > 0 ? `${fmtSol(u.totalDonated, 2)} SOL given` : 'New on Umanity')}</p>
                </div>
                {u.streakCurrent > 0 && <span className="text-[11px] font-semibold counter text-[#86868b]">🔥 {u.streakCurrent}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PeopleSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PublicUser[] | null>(null)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (t.current) clearTimeout(t.current)
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    t.current = setTimeout(() => {
      apiGet<{ profiles?: PublicUser[] }>(`/api/social/search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => setResults(d.profiles ?? []))
        .catch(() => setResults([]))
    }, 250)
  }, [q])

  return (
    <div className="relative">
      <div className="relative">
        <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="input !pl-11 !bg-white" />
      </div>
      {results && (
        <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-white rounded-2xl border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden animate-in">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-[#86868b]">No one by that name yet.</p>
          ) : (
            results.map((u) => (
              <Link key={u.address} href={`/u/${u.username}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.03]">
                <Avatar username={u.username} url={u.avatarUrl} size={32} />
                <span className="text-[13px] font-medium">@{u.username}</span>
                {u.totalDonated > 0 && <span className="ml-auto text-[11px] text-[#86868b] counter">{fmtSol(u.totalDonated, 2)} SOL</span>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
