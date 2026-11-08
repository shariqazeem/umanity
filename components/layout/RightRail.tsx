'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { ProofOrb } from '@/components/shared/ProofOrb'
import { useMoney } from '@/components/drops/hooks'
import { useSeed } from '@/components/drops/seed'
import { apiGet, short, timeAgo } from '@/lib/client/api'
import { guardianFor } from '@/lib/guardian'
import { usdText } from '@/lib/umanity/drops'
import type { HomeItem, TopBacker } from '@/lib/umanity/feed'
import { activityLine } from '@/components/drops/activity'

export function RightRail() {
  return (
    <aside className="hidden xl:block w-[320px] flex-shrink-0 sticky top-0 h-[100dvh] overflow-y-auto no-scrollbar px-5 py-5 space-y-4">
      <StatsWidget />
      <GuardianWidget />
      <LeaderboardWidget />
      <ActivityWidget />
      <div className="px-2 pt-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#aeaeb2]">
          <span>Solana</span>
          <span>USDC</span>
          <span>Meteora</span>
          <span>Jupiter</span>
          <span>Aurora</span>
          <span>x402</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#aeaeb2] mt-1.5">
          <Link href="/money" className="hover:text-[#86868b]">Money</Link>
          <Link href="/agents" className="hover:text-[#86868b]">Agents API</Link>
          <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#86868b]">@umanity_xyz</a>
        </div>
        <p className="text-[10px] text-[#d4d4d4] mt-2">&copy; 2026 Umanity</p>
      </div>
    </aside>
  )
}

function StatsWidget() {
  const { data: money } = useMoney(30_000)
  if (!money) return <div className="card p-4 h-[196px] skeleton" />
  const t = money.totals
  const rows: [string, string, string?][] = [
    ['Given', usdText(t.cameIn, 2), `${t.gifts.toLocaleString()} ${t.gifts === 1 ? 'gift' : 'gifts'}`],
    ['In pots', usdText(t.inPots, 2)],
    ['Delivered', usdText(t.unlocked, 2)],
    ['Fees to drops', usdText(money.fees.toDrops, 2)],
    ['Refunded', usdText(t.refunded, 2)],
  ]
  return (
    <Link href="/money" className="card-interactive p-4 block">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[15px]">Money</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          On-chain
        </span>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value, sub]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[13px] text-[#86868b]">{label}</span>
            <span className="text-right">
              <span className="text-[15px] font-bold counter">{value}</span>
              {sub && <span className="block text-[10px] text-[#aeaeb2] counter">{sub}</span>}
            </span>
          </div>
        ))}
      </div>
    </Link>
  )
}

function GuardianWidget() {
  const { user } = useUmanity()
  if (!user) return null
  const g = guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount })
  return (
    <Link href="/profile" className="card-interactive p-4 flex items-center gap-3.5 block">
      <ProofOrb totalDonated={user.totalDonated} engagement={user.donationCount} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="eyebrow">Your Guardian</p>
        <p className="text-[15px] font-bold tracking-tight">{g.tier}</p>
        <div className="progress emerald mt-1.5">
          <span style={{ width: `${Math.round(g.progress * 100)}%` }} />
        </div>
        <p className="text-[11px] text-[#86868b] mt-1 counter">
          {user.rewardPoints.toLocaleString()} pts{user.streakCurrent > 0 ? ` · 🔥 ${user.streakCurrent}-day streak` : ''}
        </p>
      </div>
    </Link>
  )
}

const LB_TABS = [
  { key: 'usd', label: 'Given' },
  { key: 'gifts', label: 'Gifts' },
  { key: 'drops', label: 'Drops' },
] as const

function LeaderboardWidget() {
  const seed = useSeed()
  const [rows, setRows] = useState<TopBacker[] | null>(seed.backers ?? null)
  const [tab, setTab] = useState<(typeof LB_TABS)[number]['key']>('usd')
  useEffect(() => {
    apiGet<{ backers?: TopBacker[] }>('/api/backers')
      .then((d) => setRows(d.backers ?? []))
      .catch(() => setRows([]))
  }, [])
  const sorted = [...(rows ?? [])].sort((a, b) => (tab === 'usd' ? b.totalUsd - a.totalUsd : tab === 'gifts' ? b.gifts - a.gifts : b.drops - a.drops)).slice(0, 5)
  return (
    <div className="card p-4">
      <h3 className="font-bold text-[15px] mb-3">Top backers</h3>
      <div className="flex gap-1.5 mb-3">
        {LB_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${tab === t.key ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!rows ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-[12px] text-[#aeaeb2] text-center py-6">No one yet. The first gift takes the top spot.</p>
      ) : (
        <ol className="space-y-1">
          {sorted.map((r, i) => {
            const row = (
              <>
                <span className={`w-4 text-[11px] font-bold counter ${i === 0 ? 'text-emerald-600' : 'text-[#aeaeb2]'}`}>{i + 1}</span>
                <Avatar username={r.username ?? r.address} url={r.avatarUrl} size={28} />
                <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{r.username ? `@${r.username}` : short(r.address)}</span>
                <span className="text-[12px] font-semibold counter text-[#1d1d1f]">{tab === 'usd' ? usdText(r.totalUsd, r.totalUsd % 1 ? 2 : 0) : tab === 'gifts' ? r.gifts : r.drops}</span>
              </>
            )
            return (
              <li key={r.address}>
                {r.username ? (
                  <Link href={`/u/${r.username}`} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl hover:bg-black/[0.03] transition-colors">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 px-1.5 py-1.5">{row}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function ActivityWidget() {
  const seed = useSeed()
  const [rows, setRows] = useState<HomeItem[] | null>(seed.feed ? seed.feed.filter((i) => i.type !== 'post').slice(0, 12) : null)
  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ items?: HomeItem[] }>('/api/feed/drops?limit=12')
        .then((d) => alive && setRows((d.items ?? []).filter((i) => i.type !== 'post')))
        .catch(() => alive && setRows([]))
    load()
    const t = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[15px]">Recent activity</h3>
      </div>
      {!rows ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12px] text-[#aeaeb2] text-center py-6">No activity yet</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <p className="text-[12px] leading-snug text-[#525252] min-w-0">
                {activityLine(a)}
                <span className="text-[#aeaeb2]"> · {timeAgo(a.at)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
