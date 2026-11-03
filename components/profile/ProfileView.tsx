'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar } from '@/components/shared/ui'
import { ProofOrb } from '@/components/shared/ProofOrb'
import { DareCard } from '@/components/dares/DareCard'
import { PostCard } from '@/components/feed/PostCard'
import { apiGet, apiSend, fmtSol, fmtUsd, short, timeAgo } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { getCause } from '@/lib/causes'
import { TIERS } from '@/lib/guardian'
import { chainLabel } from '@/components/feed/types'
import { useProfile } from './useProfile'
import { shownName } from '@/lib/client/names'
import type { PublicProfile, GiftView, CertView } from '@/lib/contracts'

type Tab = 'gifts' | 'certificates' | 'dares' | 'posts'

export function ProfileView({ username, mode }: { username: string; mode: 'own' | 'public' }) {
  const { address, solPrice, openProfileEditor, openWalletSheet, openGive, ensureSigner, toast } = useUmanity()
  const { profile, loading, error, reload, setProfile } = useProfile(username, address)
  const [tab, setTab] = useState<Tab>('gifts')
  const [isAdmin, setIsAdmin] = useState(false)
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number; donationDays: string[] } | null>(null)
  const own = mode === 'own'

  useEffect(() => {
    if (!own || !address) return
    apiGet<{ isAdmin?: boolean }>(`/api/admin/me?address=${address}`)
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [own, address])

  useEffect(() => {
    if (!profile) return
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
    const text = own ? `My giving on @umanity_xyz: ${fmtSol(p.totalDonated, 2)} SOL, held in escrow until it is delivered by hand and proven.\n\n${origin}/u/${p.username}` : `@${p.username} on @umanity_xyz\n\n${origin}/u/${p.username}`
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
                  🚚 Field console
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
              {!isSelf && (
                <Link href={`/home?compose=dare&target=${p.username}`} className="h-9 px-3.5 inline-flex items-center rounded-xl bg-amber-50 text-amber-700 text-[12.5px] font-semibold hover:bg-amber-100">
                  ⚡ Dare @{p.username}
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      <GuardianCard p={p} solPrice={solPrice} />

      {/* Streak + causes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard current={streak?.currentStreak ?? p.streakCurrent} longest={streak?.longestStreak ?? p.streakLongest} days={streak?.donationDays ?? []} />
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[15px]">Causes backed</h3>
            {own && (
              <button onClick={() => openGive()} className="btn-primary h-8 px-3 !text-[12px]">
                ♡ Give
              </button>
            )}
          </div>
          {p.causes.length === 0 ? (
            <p className="text-[13px] text-[#86868b] leading-relaxed">{own ? 'Your first gift starts the pass, the streak and the certificates. 0.01 SOL is enough.' : 'No gifts yet.'}</p>
          ) : (
            <ul className="space-y-2">
              {p.causes.map((c) => (
                <li key={c.poolId}>
                  <Link href={`/causes/${c.poolId}`} className="flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-xl hover:bg-black/[0.03]">
                    <span className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center">{getCause(c.poolId)?.emoji ?? c.emoji}</span>
                    <span className="flex-1 text-[13px] font-medium">{c.name}</span>
                    <span className="text-[12px] font-semibold counter">{fmtSol(c.amount, 3)} SOL</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 pt-2">
        {(
          [
            ['gifts', `Receipts${p.gifts.length ? ` · ${p.gifts.length}` : ''}`],
            ['certificates', `Certificates${p.certificates.length ? ` · ${p.certificates.length}` : ''}`],
            ['dares', `Dares${p.dares.length ? ` · ${p.dares.length}` : ''}`],
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

      {tab === 'gifts' && <Receipts gifts={p.gifts} solPrice={solPrice} />}
      {tab === 'certificates' && <Certificates certs={p.certificates} owner={p.address} />}
      {tab === 'dares' && (p.dares.length === 0 ? <EmptyLine text="No dares yet." /> : <div className="space-y-2.5">{p.dares.map((d) => <DareCard key={d.id} dare={d} />)}</div>)}
      {tab === 'posts' && (p.posts.length === 0 ? <EmptyLine text="No posts yet." /> : <div className="space-y-2.5">{p.posts.filter((x) => x.type !== 'joined').map((x) => <PostCard key={x.id} post={x} />)}</div>)}
    </div>
  )
}

/** The Living Guardian pass: a collectible that grows with giving, streaks and votes. */
function GuardianCard({ p, solPrice }: { p: PublicProfile; solPrice: number | null }) {
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
        <ProofOrb totalDonated={p.totalDonated} engagement={p.donationCount} size="lg" />
      </div>

      <div className="relative grid grid-cols-4 gap-3 mt-6">
        {[
          ['Given', `${fmtSol(p.totalDonated, 2)}`, solPrice ? fmtUsd(p.totalDonated * solPrice) : 'SOL'],
          ['Gifts', String(p.donationCount), `${p.causes.length} causes`],
          ['Votes', String(p.votes), 'on releases'],
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

function Receipts({ gifts, solPrice }: { gifts: GiftView[]; solPrice: number | null }) {
  if (gifts.length === 0) return <EmptyLine text="No gifts yet. Every gift shows up here with its on-chain receipt." />
  return (
    <div className="card divide-y divide-black/[0.04]">
      {gifts.map((g) => {
        const cause = getCause(g.poolId)
        const via = g.route === 'intents' ? `from ${chainLabel(g.sourceChain) ?? 'another chain'}` : g.route === 'x402' ? 'via x402' : g.route === 'multihopper' ? 'private route' : g.route === 'blink' ? 'via Blink' : 'Solana'
        return (
          <div key={g.id} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.015] transition-colors">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">{cause?.emoji ?? '💚'}</span>
            <Link href={`/gift/${g.id}`} className="flex-1 min-w-0 group">
              <p className="text-[13px] font-semibold truncate group-hover:underline">{g.poolName}</p>
              <p className="text-[11px] text-[#86868b]">
                {via} · {timeAgo(g.createdAt)} · <span className="text-emerald-600 font-medium">follow →</span>
              </p>
            </Link>
            <div className="text-right">
              <p className="text-[13px] font-bold counter">{fmtSol(g.amount, 3)} SOL</p>
              {solPrice && <p className="text-[10px] text-[#aeaeb2] counter">{fmtUsd(g.amount * solPrice)}</p>}
            </div>
            {g.signature && !g.signature.startsWith('x402_') && (
              <a href={explorerTx(g.signature)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-600 font-medium hover:underline">
                Solscan ↗
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

const CERT: Record<string, { label: string; bg: string; accent: string; emoji: string }> = {
  bronze: { label: 'Bronze', bg: 'bg-amber-50', accent: 'text-amber-600', emoji: '🥉' },
  silver: { label: 'Silver', bg: 'bg-[#f5f5f7]', accent: 'text-[#86868b]', emoji: '🥈' },
  gold: { label: 'Gold', bg: 'bg-yellow-50', accent: 'text-yellow-600', emoji: '🥇' },
  diamond: { label: 'Diamond', bg: 'bg-sky-50', accent: 'text-sky-600', emoji: '💎' },
}

function Certificates({ certs, owner }: { certs: CertView[]; owner: string }) {
  if (certs.length === 0) return <EmptyLine text="Every gift mints a soulbound impact certificate. None yet." />
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {certs.map((c) => {
        const t = CERT[c.tier] ?? CERT.bronze
        return (
          <div key={c.id} className="card overflow-hidden group">
            <div className={`${t.bg} p-6 text-center relative transition-all group-hover:py-7`}>
              <div className="text-3xl mb-1.5">{t.emoji}</div>
              <div className={`text-[9px] font-semibold ${t.accent} uppercase tracking-[0.2em]`}>{t.label} Impact</div>
              <span className="absolute top-2.5 right-2.5 pill bg-white/70 text-[#86868b] !text-[8px]">Soulbound</span>
            </div>
            <div className="p-4">
              <p className="font-semibold text-[13px] mb-2 truncate">{c.causeName}</p>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#86868b]">Amount</span>
                <span className="font-bold counter">{fmtSol(c.amount, 3)} SOL</span>
              </div>
              <div className="flex justify-between text-[11px] mt-1">
                <span className="text-[#86868b]">Owner</span>
                <span className="font-mono text-[#86868b]">{short(owner)}</span>
              </div>
              {c.signature && !c.signature.startsWith('x402_') && (
                <a href={explorerTx(c.signature)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-[10px] text-[#aeaeb2] hover:text-[#525252]">
                  View transaction
                </a>
              )}
            </div>
          </div>
        )
      })}
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
