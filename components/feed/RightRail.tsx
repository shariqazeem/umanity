'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Card, Icon, Progress, Skeleton } from '@/components/shared/ui'
import { apiGet, apiSend, fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { guardianFor } from '@/lib/guardian'
import type { ActivityRow, LeaderRow } from './types'
import { chainLabel } from './types'

export function RightRail() {
  return (
    <aside className="hidden xl:block w-[300px] flex-shrink-0">
      <div className="sticky top-[88px] space-y-4">
        <YourImpact />
        <Live />
        <TopGivers />
        <p className="text-[11.5px] text-[#aeaeb2] px-1">
          <Link href="/how-it-works" className="hover:text-[#1d1d1f]">
            How Umanity works
          </Link>
          {' · '}
          <Link href="/transparency" className="hover:text-[#1d1d1f]">
            Transparency
          </Link>
        </p>
      </div>
    </aside>
  )
}

function YourImpact() {
  const { user, signer, solPrice, openAuth, openGive } = useUmanity()
  if (!signer || !user) {
    return (
      <Card className="p-5">
        <p className="font-display text-[24px] leading-tight">Your giving, in one place.</p>
        <p className="text-[13px] text-[#6e6e73] mt-2 leading-relaxed">Create a wallet in a tap. Every gift, certificate and delivery you fund shows up here.</p>
        <Btn size="md" full className="mt-4" icon="bolt" onClick={openAuth}>
          Create your wallet
        </Btn>
      </Card>
    )
  }
  const g = guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount })
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Your impact</p>
        <Link href="/profile" className="text-[12px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] inline-flex items-center gap-1">
          Profile <Icon name="arrowRight" size={12} />
        </Link>
      </div>
      <p className="num text-[28px] font-bold mt-2 leading-none">{fmtSol(user.totalDonated, 3)} SOL</p>
      <p className="text-[12.5px] text-[#6e6e73] mt-1 num">
        {solPrice ? `${fmtUsd(user.totalDonated * solPrice)} given · ` : ''}
        {user.donationCount} {user.donationCount === 1 ? 'gift' : 'gifts'}
      </p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold inline-flex items-center gap-1">
            <Icon name="spark" size={12} /> {g.tier}
          </span>
          <span className="text-[#6e6e73] num">{g.nextTier ? `${g.pointsToNext.toLocaleString()} to ${g.nextTier}` : 'top tier'}</span>
        </div>
        <Progress value={g.progress} max={1} className="mt-1.5" />
      </div>
      <div className="flex items-center justify-between mt-3 text-[12px] text-[#6e6e73]">
        <span className="num">{user.rewardPoints.toLocaleString()} points</span>
        <span className="inline-flex items-center gap-1 num">
          <Icon name="flame" size={12} /> {user.streakCurrent}-day streak
        </span>
      </div>
      {user.donationCount === 0 && (
        <Btn tone="accent" size="md" full className="mt-4" icon="heart" onClick={() => openGive()}>
          Make your first gift
        </Btn>
      )}
    </Card>
  )
}

function Live() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ activities?: ActivityRow[] }>('/api/activity?limit=10')
        .then((d) => alive && setRows(d.activities ?? []))
        .catch(() => alive && setRows([]))
    load()
    const t = setInterval(load, 45_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return (
    <Card className="p-5">
      <p className="eyebrow inline-flex items-center gap-2">
        <span className="pulse-dot" /> Live
      </p>
      {rows === null ? (
        <div className="space-y-2.5 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-[#6e6e73] mt-3">Quiet right now. The next gift shows up here.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => {
            const chain = chainLabel(r.sourceChain)
            const name = r.username ? `@${r.username}` : chain ? `Someone on ${chain}` : 'Someone'
            return (
              <li key={r.id} className="flex items-start gap-2.5">
                <Avatar username={r.username || 'u'} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug truncate">
                    {r.username ? (
                      <Link href={`/u/${r.username}`} className="font-semibold hover:underline underline-offset-2">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{name}</span>
                    )}{' '}
                    gave <span className="num">{fmtSol(r.amount, 3)} SOL</span> to{' '}
                    <Link href={`/causes/${r.poolId}`} className="hover:underline underline-offset-2">
                      {r.poolName}
                    </Link>
                  </p>
                  <p className="text-[11px] text-[#aeaeb2]">{timeAgo(r.timestamp)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function TopGivers() {
  const { address, ensureSigner, toast } = useUmanity()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  useEffect(() => {
    apiGet<{ leaderboards?: { topDonors?: LeaderRow[] } }>('/api/leaderboard')
      .then((d) => setRows((d.leaderboards?.topDonors ?? []).slice(0, 5)))
      .catch(() => setRows([]))
  }, [])
  const follow = async (u: LeaderRow) => {
    const s = ensureSigner()
    if (!s) return
    try {
      await apiSend('/api/social/follow', { followerAddress: address ?? s.publicKey.toBase58(), followeeAddress: u.address })
      setFollowing((f) => new Set(f).add(u.address))
      toast(`Following @${u.username}.`, 'ok')
    } catch {
      toast('Could not follow right now', 'err')
    }
  }
  return (
    <Card className="p-5">
      <p className="eyebrow inline-flex items-center gap-2">
        <Icon name="trophy" size={12} /> Top givers
      </p>
      {rows === null ? (
        <div className="space-y-2.5 mt-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-[#6e6e73] mt-3">The first gift takes the top spot.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((u, i) => (
            <li key={u.address} className="flex items-center gap-2.5">
              <span className="w-4 text-[11px] text-[#aeaeb2] num text-right">{i + 1}</span>
              <Link href={`/u/${u.username}`}>
                <Avatar username={u.username} size={28} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${u.username}`} className="block text-[12.5px] font-semibold truncate hover:underline underline-offset-2">
                  {u.displayName || `@${u.username}`}
                </Link>
                <p className="text-[11px] text-[#aeaeb2] num">{fmtSol(u.totalDonated ?? 0, 2)} SOL</p>
              </div>
              {address !== u.address && (
                <button onClick={() => follow(u)} disabled={following.has(u.address)} className="text-[11.5px] font-semibold text-[#047857] hover:underline underline-offset-2 disabled:text-[#aeaeb2] disabled:no-underline">
                  {following.has(u.address) ? 'Following' : 'Follow'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
