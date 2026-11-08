'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { ProofOrb } from '@/components/shared/ProofOrb'
import { PostCard } from '@/components/feed/PostCard'
import { apiGet, apiSend, fmtSol, short, timeAgo } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { TIERS } from '@/lib/guardian'
import { useProfile } from './useProfile'
import { dropHref } from '@/components/drops/DropParts'
import { pickNextDrop, useDrops } from '@/components/drops/hooks'
import { usdText } from '@/lib/umanity/drops'
import type { BackerProfile } from '@/lib/umanity/profile'
import { shownName } from '@/lib/client/names'
import type { PublicProfile } from '@/lib/contracts'

type Tab = 'gifts' | 'posts'

export function ProfileView({ username, mode }: { username: string; mode: 'own' | 'public' }) {
  const { address, openProfileEditor, openWalletSheet, openGive, ensureSigner, toast } = useUmanity()
  const { profile, loading, error, reload, setProfile } = useProfile(username, address)
  const [tab, setTab] = useState<Tab>('gifts')
  const [isAdmin, setIsAdmin] = useState(false)
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number; donationDays: string[] } | null>(null)
  const [backer, setBacker] = useState<BackerProfile | null>(null)
  const { data: drops } = useDrops(60_000)
  const next = pickNextDrop(drops)
  const own = mode === 'own'

  useEffect(() => {
    if (!own || !address) return
    apiGet<{ isAdmin?: boolean }>(`/api/admin/me?address=${address}`)
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [own, address])

  useEffect(() => {
    if (!profile) return
    apiGet<BackerProfile>(`/api/profile/drops?address=${profile.address}`)
      .then((d) => setBacker(d.totals ? d : null))
      .catch(() => setBacker(null))
    apiGet<{ donationDays?: string[]; currentStreak?: number; longestStreak?: number }>(`/api/streaks?address=${profile.address}`)
      .then((d) => setStreak({ currentStreak: d.currentStreak ?? 0, longestStreak: d.longestStreak ?? 0, donationDays: d.donationDays ?? [] }))
      .catch(() => setStreak(null))
  }, [profile])

  if (loading && !profile) return <ProfileSkeleton />
  if (!profile) {
    return (
      <div className="card p-10 text-center mt-4">
        <p className="font-semibold">{error ?? 'Profile not found'}</p>
        <p className="text-[13px] text-[#86868b] mt-1">There is no one with that name yet.</p>
        <Link href="/home" className="btn-secondary px-4 py-2 mt-4 !text-[13px]">
          Back to the feed
        </Link>
      </div>
    )
  }

  const p = profile
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const isSelf = address === p.address
  const share = () => {
    const given = backer?.totals.givenUsd ?? 0
    const text = own && given > 0 ? `I've put ${usdText(given, 2)} into ${backer!.totals.drops} ${backer!.totals.drops === 1 ? 'drop' : 'drops'} on @umanity_xyz. Each pot pays out only after the delivery is filmed and checked.\n\n${origin}/u/${p.username}` : `@${p.username} on @umanity_xyz\n\n${origin}/u/${p.username}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const invite = () => navigator.clipboard.writeText(`${origin}/?ref=${p.username}`).then(() => toast('Invite link copied. When they give, you both earn points.', 'ok'))

  const follow = async () => {
    const s = ensureSigner()
    if (!s) return
    const next = !p.viewerFollows
    setProfile({ ...p, viewerFollows: next, followers: p.followers + (next ? 1 : -1) })
    try {
      await apiSend('/api/social/follow', { followerAddress: address ?? s.publicKey.toBase58(), followeeAddress: p.address }, next ? 'POST' : 'DELETE')
    } catch {
      toast('Could not update follow', 'err')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card p-5 md:p-6">
        <div className="flex items-start gap-4">
          <Avatar username={p.username} url={p.avatarUrl} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[22px] font-bold tracking-[-0.02em] leading-tight truncate">{shownName(p.displayName, p.username) ?? `@${p.username}`}</h2>
              {p.foundingRank != null && p.foundingRank <= 100 && <span className="pill bg-emerald-50 text-emerald-700 !text-[10px] font-semibold">Founding giver #{p.foundingRank}</span>}
            </div>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              @{p.username} · <span className="font-mono text-[11px]">{short(p.address)}</span>
            </p>
            {p.bio && <p className="text-[14px] mt-2 leading-relaxed">{p.bio}</p>}
            <div className="flex items-center gap-4 mt-3 text-[13px]">
              <span>
                <span className="font-bold counter">{p.followers}</span> <span className="text-[#86868b]">followers</span>
              </span>
              <span>
                <span className="font-bold counter">{p.following}</span> <span className="text-[#86868b]">following</span>
              </span>
              <span>
                <span className="font-bold counter text-emerald-600">{p.rewardPoints.toLocaleString()}</span> <span className="text-[#86868b]">points</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {own ? (
            <>
              <button onClick={openProfileEditor} className="btn-secondary h-9 px-3.5 !text-[12.5px]">
                {p.handleClaimed ? 'Edit profile' : '✦ Pick your name'}
              </button>
              <button onClick={openWalletSheet} className="btn-secondary h-9 px-3.5 !text-[12.5px]">
                Wallet
              </button>
              <button onClick={share} className="btn-secondary h-9 px-3.5 !text-[12.5px]">
                Share
              </button>
              <button onClick={invite} className="btn-secondary h-9 px-3.5 !text-[12.5px]">
                Invite
              </button>
              {isAdmin && (
                <Link href="/admin" className="btn-primary h-9 px-3.5 !text-[12.5px]">
                  🚚 Team console
                </Link>
              )}
            </>
          ) : (
            <>
              {!isSelf && (
                <button onClick={follow} className={`h-9 px-4 !text-[12.5px] ${p.viewerFollows ? 'btn-secondary' : 'btn-primary'}`}>
                  {p.viewerFollows ? 'Following' : 'Follow'}
                </button>
              )}
              <button onClick={share} className="btn-secondary h-9 px-3.5 !text-[12.5px]">
                Share
              </button>
            </>
          )}
        </div>
      </section>

      <GuardianCard p={p} backer={backer} />

      {/* Streak + causes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard current={streak?.currentStreak ?? p.streakCurrent} longest={streak?.longestStreak ?? p.streakLongest} days={streak?.donationDays ?? []} />
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[15px]">Drops backed</h3>
            {own && next && (
              <button onClick={() => openGive({ dropId: next.id })} className="btn-primary h-8 px-3 !text-[12px]">
                ♡ Give
              </button>
            )}
          </div>
          {!backer || backer.drops.length === 0 ? (
            <p className="text-[13px] text-[#86868b] leading-relaxed">{own ? 'Your first gift starts the streak and the points. A dollar is enough, and it comes back if the drop misses its date.' : 'No gifts yet.'}</p>
          ) : (
            <ul className="space-y-2">
              {backer.drops.map((d) => (
                <li key={d.id}>
                  <Link href={dropHref(d.id)} className="flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-xl hover:bg-black/[0.03]">
                    <span className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center">{d.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium truncate">
                        #{d.id + 1} {d.title}
                      </span>
                      <span className={`block text-[11px] ${d.refundsOpen ? 'text-amber-700' : d.state === 'unlocked' ? 'text-emerald-600' : 'text-[#86868b]'}`}>
                        {d.refundedUsd > 0 ? `${usdText(d.refundedUsd, 2)} refunded` : d.refundsOpen ? 'Refunding' : d.state === 'unlocked' ? 'Delivered' : d.state === 'proven' ? 'Proof posted, checking' : 'Filling'}
                      </span>
                    </span>
                    <span className="text-[12px] font-semibold counter">{usdText(d.amountUsd, 2)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {backer && backer.totals.trades > 0 && (
            <p className="text-[11.5px] text-[#86868b] mt-3 pt-3 border-t border-black/[0.04]">
              {backer.totals.trades} {backer.totals.trades === 1 ? 'swap' : 'swaps'} · your fees sent <span className="font-semibold text-emerald-600">{usdText(backer.totals.feesToDropsUsd, 2)}</span> to drops
            </p>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 pt-2">
        {(
          [
            ['gifts', `Receipts${backer?.gifts.length ? ` · ${backer.gifts.length}` : ''}`],
            ['posts', 'Posts'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${tab === k ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'}`}>
            {l}
          </button>
        ))}
        <button onClick={reload} className="ml-auto text-[12px] text-[#aeaeb2] hover:text-[#1d1d1f]">
          Refresh
        </button>
      </div>

      {tab === 'gifts' && <Receipts gifts={backer?.gifts ?? []} />}
      {tab === 'posts' && (p.posts.length === 0 ? <EmptyLine text="No posts yet." /> : <div className="space-y-2.5">{p.posts.filter((x) => x.type !== 'joined').map((x) => <PostCard key={x.id} post={x} />)}</div>)}
    </div>
  )
}

/** The Living Guardian pass: a collectible that grows with giving, streaks and votes. */
function GuardianCard({ p, backer }: { p: PublicProfile; backer: BackerProfile | null }) {
  const given = backer?.totals.givenUsd ?? 0
  const g = p.guardian
  const idx = TIERS.findIndex((t) => t.tier === g.tier)
  return (
    <section className="relative overflow-hidden rounded-[28px] p-6 md:p-7 text-white" style={{ background: 'linear-gradient(135deg, #111113 0%, #1d1d1f 55%, #0f2a22 100%)' }}>
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 bottom-0 w-56 h-56 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Living Guardian · Tier {g.level} of {TIERS.length}
          </p>
          <h3 className="text-[40px] md:text-[48px] font-black tracking-[-0.04em] leading-none mt-2">{g.tier}</h3>
          <p className="text-[12px] text-white/50 mt-2">
            @{p.username} · <span className="font-mono">{short(p.address)}</span>
          </p>
        </div>
        {/* The orb's tiers were set in SOL; a hundred dollars is about one. */}
        <ProofOrb totalDonated={given / 100} engagement={p.donationCount} size="lg" />
      </div>

      <div className="relative grid grid-cols-4 gap-3 mt-6">
        {[
          ['Given', usdText(given, given % 1 ? 2 : 0), 'in USDC'],
          ['Gifts', String(backer?.totals.gifts ?? 0), `${backer?.totals.drops ?? 0} drops`],
          ['Delivered', usdText(backer?.totals.deliveredUsd ?? 0, 0), 'proven on camera'],
          ['Score', g.score.toLocaleString(), g.nextTier ? `${g.pointsToNext} to ${g.nextTier}` : 'max tier'],
        ].map(([l, v, s]) => (
          <div key={l} className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">{l}</p>
            <p className="text-[20px] md:text-[24px] font-bold counter leading-tight mt-0.5">{v}</p>
            <p className="text-[10px] text-white/40 truncate">{s}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-5">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-700" style={{ width: `${Math.round(g.progress * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between mt-3 gap-3">
          <div className="flex items-center gap-1.5">
            {TIERS.map((t, i) => (
              <span key={t.tier} title={t.tier} className="h-1.5 rounded-full transition-all" style={{ width: i <= idx ? 22 : 10, background: i <= idx ? '#34d399' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
          <p className="text-[11px] text-white/50 truncate">{g.perks.join(' · ')}</p>
        </div>
      </div>
    </section>
  )
}

function StreakCard({ current, longest, days }: { current: number; longest: number; days: string[] }) {
  const set = new Set(days.map((d) => d.slice(0, 10)))
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    return { key, label: d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' }), on: set.has(key) }
  })
  const onFire = current >= 3
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${onFire ? 'animate-pulse' : ''}`} style={onFire ? { filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.7))' } : undefined}>
            🔥
          </span>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold counter">{current}</span>
              <span className="text-xs text-[#86868b]">day streak</span>
            </div>
            {onFire && <span className="inline-block pill !text-[10px] font-semibold text-orange-600 bg-orange-50 mt-0.5">On fire</span>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-[#86868b]">Best </span>
          <span className="text-sm font-semibold counter">{longest}d</span>
        </div>
      </div>
      <div className="pt-3 border-t border-black/[0.03] flex items-center justify-between">
        {last7.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-[#d4d4d4] font-medium">{d.label}</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${d.on ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-[#f5f5f7] border border-black/[0.05]'}`}>
              {d.on && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const VIA: Record<string, string> = { wallet: 'Your wallet', welcome: 'Welcome gift', x402: 'Agent · x402', intents: 'Another chain', fund: 'Drops fund' }

function Receipts({ gifts }: { gifts: BackerProfile['gifts'] }) {
  if (gifts.length === 0) return <EmptyLine text="No gifts yet. Every gift shows up here with its transaction." />
  return (
    <div className="card divide-y divide-black/[0.04]">
      {gifts.map((g) => (
        <div key={g.ref} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.015] transition-colors">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">{g.emoji}</span>
          <Link href={dropHref(g.dropId)} className="flex-1 min-w-0 group">
            <p className="text-[13px] font-semibold truncate group-hover:underline">
              #{g.dropId + 1} {g.title}
            </p>
            <p className="text-[11px] text-[#86868b]">
              {VIA[g.channel] ?? 'Gift'} · {timeAgo(g.at)}
            </p>
          </Link>
          <p className="text-[13px] font-bold counter">{usdText(g.amountUsd, 2)}</p>
          {g.signature && (
            <a href={explorerTx(g.signature)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-600 font-medium hover:underline">
              Solscan ↗
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="card p-8 text-center text-[13px] text-[#86868b]">{text}</div>
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-40 !rounded-[20px]" />
      <div className="skeleton h-56 !rounded-[28px]" />
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
      </div>
    </div>
  )
}
