'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { ProofOrb } from '@/components/shared/ProofOrb'
import { useStats } from '@/lib/client/hooks'
import { apiGet, fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { guardianFor } from '@/lib/guardian'
import { chainLabel } from '@/components/feed/types'
import type { ActivityRow, LeaderRow } from '@/components/feed/types'

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
          <span>Anchor</span>
          <span>NEAR Intents</span>
          <span>Aurora</span>
          <span>x402</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#aeaeb2] mt-1.5">
          <Link href="/transparency" className="hover:text-[#86868b]">Ledger</Link>
          <Link href="/agents" className="hover:text-[#86868b]">Agents API</Link>
          <a href="https://x.com/umanity_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#86868b]">@umanity_xyz</a>
        </div>
        <p className="text-[10px] text-[#d4d4d4] mt-2">&copy; 2026 Umanity</p>
      </div>
    </aside>
  )
}

function StatsWidget() {
  const stats = useStats()
  const { solPrice } = useUmanity()
  if (!stats) return <div className="card p-4 h-[196px] skeleton" />
  const rows: [string, string, string?][] = [
    ['SOL given', fmtSol(stats.totalDonations, 2), solPrice ? fmtUsd(stats.totalDonations * solPrice) : undefined],
    ['In escrow', fmtSol(stats.totalEscrowed, 2)],
    ['Gifts', String(stats.totalGifts)],
    ['Any-chain gifts', String(stats.crossChainCount)],
    ['Agent payments', String(stats.x402Calls)],
  ]
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[15px]">Platform Stats</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
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
    </div>
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
  { key: 'topDonors', label: 'Top' },
  { key: 'topEarners', label: 'Points' },
  { key: 'streakLeaders', label: 'Streak' },
  { key: 'dareChampions', label: 'Dares' },
] as const

function LeaderboardWidget() {
  const [data, setData] = useState<Record<string, LeaderRow[]> | null>(null)
  const [tab, setTab] = useState<(typeof LB_TABS)[number]['key']>('topDonors')
  useEffect(() => {
    apiGet<{ leaderboards?: Record<string, LeaderRow[]> }>('/api/leaderboard')
      .then((d) => setData(d.leaderboards ?? {}))
      .catch(() => setData({}))
  }, [])
  const rows = (data?.[tab] ?? []).slice(0, 5)
  return (
    <div className="card p-4">
      <h3 className="font-bold text-[15px] mb-3">Top Donors</h3>
      <div className="flex gap-1.5 mb-3">
        {LB_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${tab === t.key ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12px] text-[#aeaeb2] text-center py-6">No one yet. The first gift takes the top spot.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.address}>
              <Link href={`/u/${r.username}`} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl hover:bg-black/[0.03] transition-colors">
                <span className={`w-4 text-[11px] font-bold counter ${i === 0 ? 'text-emerald-600' : 'text-[#aeaeb2]'}`}>{i + 1}</span>
                <Avatar username={r.username} size={28} />
                <span className="flex-1 min-w-0 text-[13px] font-medium truncate">@{r.username}</span>
                <span className="text-[12px] font-semibold counter text-[#1d1d1f]">
                  {tab === 'topDonors' && `${fmtSol(r.totalDonated ?? 0, 2)}`}
                  {tab === 'topEarners' && `${(r.rewardPoints ?? 0).toLocaleString()}`}
                  {tab === 'streakLeaders' && `🔥 ${r.streak ?? 0}`}
                  {tab === 'dareChampions' && `${fmtSol(r.totalStaked ?? 0, 2)}`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ActivityWidget() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ activities?: ActivityRow[] }>('/api/activity?limit=8')
        .then((d) => alive && setRows(d.activities ?? []))
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
        <h3 className="font-bold text-[15px]">Recent Activity</h3>
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
                <ActivityText a={a} />
                <span className="text-[#aeaeb2]"> · {timeAgo(a.timestamp)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ActivityText({ a }: { a: ActivityRow }) {
  const amt = <span className="font-semibold text-[#1d1d1f] counter">{fmtSol(a.amount, a.amount < 0.1 ? 3 : 2)} SOL</span>
  const cause = <span className="text-[#1d1d1f]">{a.poolName}</span>
  if (a.type === 'intent' || a.type === 'intent_settled') {
    return (
      <>
        {a.username ? `@${a.username} gave ` : 'A gift of '}
        {amt} from {chainLabel(a.sourceChain) ?? 'another chain'} to {cause}
      </>
    )
  }
  if (a.type === 'discreet') return <>A private gift of {amt} reached {cause}</>
  if (a.type === 'payout') return <>{amt} released from {cause} escrow</>
  if (a.type === 'agent') return <>🤖 {a.username ? `@${a.username}` : 'An agent'} gave <span className="font-semibold text-[#1d1d1f] counter">{a.sourceAmount ? `$${a.sourceAmount} USDC` : amt}</span> to {cause} via x402</>
  return (
    <>
      @{a.username} gave {amt} to {cause}
    </>
  )
}
