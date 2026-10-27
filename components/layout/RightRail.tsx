'use client'

import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend, fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { Card, Mono, Pill, TxLink, Btn } from '@/components/shared/ui'
import { GradientAvatar } from '@/components/shared/GradientAvatar'
import { useStats } from './TopBar'
import type { PublicUser } from '@/lib/data/users'

interface LeaderRow {
  address: string
  username: string
  displayName: string
  totalDonated?: number
  rewardPoints?: number
  streak?: number
  totalStaked?: number
  dares?: number
}

interface Activity {
  id: string
  type: string
  username: string
  amount: number
  poolName: string
  sourceChain: string | null
  signature: string
  timestamp: string
}

export function RightRail({ onClaim }: { onClaim: () => void }) {
  const { user, solPrice, address, toast } = useUmanity()
  const stats = useStats(30_000)
  const [lb, setLb] = useState<{ topDonors: LeaderRow[]; streakLeaders: LeaderRow[]; dareChampions: LeaderRow[] } | null>(null)
  const [tab, setTab] = useState<'topDonors' | 'dareChampions' | 'streakLeaders'>('topDonors')
  const [activity, setActivity] = useState<Activity[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      apiGet<{ leaderboards?: typeof lb }>('/api/leaderboard').then((d) => d.leaderboards && setLb(d.leaderboards)).catch(() => {})
      apiGet<{ activities?: Activity[] }>('/api/activity?limit=12').then((d) => setActivity(d.activities ?? [])).catch(() => {})
    }
    load()
    const t = setInterval(load, 45_000)
    return () => clearInterval(t)
  }, [])

  const follow = async (u: LeaderRow) => {
    if (!address) return toast('Connect or start a demo wallet to follow', 'info')
    await apiSend('/api/social/follow', { followerAddress: address, followeeAddress: u.address })
    setFollowing((s) => new Set(s).add(u.address))
    toast(`Following @${u.username}`, 'ok')
  }

  const rows = lb ? lb[tab] : []

  return (
    <aside className="hidden xl:block w-[320px] flex-shrink-0 sticky top-14 h-[calc(100dvh-56px)] overflow-y-auto px-5 py-5 space-y-4">
      {user && !user.handleClaimed && (
        <Card className="p-4 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-[13px] font-bold">✨ Claim your @handle</p>
          <p className="text-[11px] text-[#52525B] mt-0.5">You are @{user.username} for now. Pick a name, mint your Seed Guardian, +50 points.</p>
          <Btn size="sm" className="mt-3 w-full" onClick={onClaim}>
            Claim handle
          </Btn>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[14px]">Protocol telemetry</h3>
          <Pill tone="gray">live</Pill>
        </div>
        {stats ? (
          <div className="space-y-2.5 text-[12px]">
            <Row label="Escrowed in vaults" value={`${fmtSol(stats.totalEscrowed, 3)} SOL`} sub={solPrice ? fmtUsd(stats.totalEscrowed * solPrice) : undefined} />
            <Row label="Lifetime donated" value={`${fmtSol(stats.totalDonations, 3)} SOL`} sub={`${stats.totalDonors} donors · ${stats.totalTransactions} tx`} />
            <Row label="Cross-chain inflows" value={`${stats.crossChainCount}`} sub={stats.crossChainVolume > 0 ? `${fmtSol(stats.crossChainVolume, 3)} SOL via NEAR Intents` : 'NEAR Intents · 31+ chains'} />
            <Row label="Discreet volume" value={`${fmtSol(stats.discreetVolume, 3)} SOL`} sub="MultiHopper, TRM-screened" />
            <Row label="Oracle audits (x402)" value={`${stats.x402Calls}`} sub={`$${Number(stats.x402Revenue).toFixed(2)} USDC settled`} />
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-4" />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-[14px] mb-2">Top impact makers</h3>
        <div className="flex gap-1 mb-3 bg-[#F3F3F1] rounded-xl p-1">
          {(
            [
              ['topDonors', 'Donors'],
              ['dareChampions', '🔥 Dares'],
              ['streakLeaders', '⚡ Streaks'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${tab === id ? 'bg-white shadow-sm text-[#111113]' : 'text-[#52525B]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-[11px] text-[#A1A1AA]">Nothing yet. Be first.</p>}
          {rows.slice(0, 6).map((u, i) => (
            <div key={u.address} className="flex items-center gap-2.5">
              <span className="w-4 text-[10px] text-[#A1A1AA] font-mono">{i + 1}</span>
              <GradientAvatar username={u.username} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">@{u.username}</p>
                <Mono className="text-[10px] text-[#52525B]">{tab === 'topDonors' ? `${fmtSol(u.totalDonated ?? 0, 3)} SOL` : tab === 'dareChampions' ? `${fmtSol(u.totalStaked ?? 0, 3)} SOL staked` : `${u.streak}-day streak`}</Mono>
              </div>
              {address !== u.address && (
                <button onClick={() => follow(u)} disabled={following.has(u.address)} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[#F3F3F1] hover:bg-[#EAEAE6] disabled:opacity-50">
                  {following.has(u.address) ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[14px]">On-chain activity</h3>
          <span className="pulse-dot" />
        </div>
        <div className="space-y-2.5">
          {activity.length === 0 && <p className="text-[11px] text-[#A1A1AA]">Waiting for the first transaction…</p>}
          {activity.map((a) => (
            <div key={a.id} className="text-[11px] leading-snug">
              <span className="font-semibold">{a.type === 'discreet' ? '🛡️ anonymous' : `@${a.username}`}</span>{' '}
              <span className="text-[#52525B]">{a.type === 'payout' ? 'payout' : 'gave'}</span> <Mono className="font-semibold">{fmtSol(a.amount, 3)} SOL</Mono>{' '}
              <span className="text-[#52525B]">→ {a.poolName}</span>
              {a.sourceChain && <span className="text-indigo-600"> from {a.sourceChain.toUpperCase()}</span>}
              <span className="text-[#A1A1AA]"> · {timeAgo(a.timestamp)}</span> <TxLink sig={a.signature} label="tx" />
            </div>
          ))}
        </div>
      </Card>
    </aside>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#52525B]">{label}</span>
      <span className="text-right">
        <Mono className="block font-semibold text-[#111113]">{value}</Mono>
        {sub && <span className="block text-[10px] text-[#A1A1AA]">{sub}</span>}
      </span>
    </div>
  )
}

export type { PublicUser }
