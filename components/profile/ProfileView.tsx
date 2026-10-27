'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Card, Pill, Skeleton, Empty, Segmented, Avatar, Img, Icon, TxLink, Stat } from '@/components/shared/ui'
import { apiGet, apiSend, fmtSol, fmtUsd, timeAgo, countdown } from '@/lib/client/api'
import { useCountdown } from '@/lib/client/hooks'
import { getCause } from '@/lib/causes'
import { GuardianPass } from './GuardianPass'
import { useProfile } from './useProfile'
import type { PublicProfile, GiftView, CertView } from '@/lib/contracts'
import type { DareView } from '@/lib/data/dares'
import type { FeedPost } from '@/lib/data/social'

type Tab = 'gifts' | 'certificates' | 'dares' | 'posts'

export function ProfileView({ username, mode }: { username: string; mode: 'own' | 'public' }) {
  const { address, solPrice, openProfileEditor, openWalletSheet, openGive, ensureSigner, toast, user } = useUmanity()
  const { profile, loading, error, reload, setProfile } = useProfile(username, address)
  const [tab, setTab] = useState<Tab>('gifts')
  const [isAdmin, setIsAdmin] = useState(false)
  const [deliveries, setDeliveries] = useState<number | null>(null)
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

  // Deliveries this person helped fund: field updates on the causes they gave to.
  useEffect(() => {
    if (!profile || profile.causes.length === 0) {
      setDeliveries(null)
      return
    }
    let alive = true
    Promise.all(profile.causes.map((c) => apiGet<{ success?: boolean; updates?: unknown[]; deliveries?: unknown[] }>(`/api/field/updates?poolId=${c.poolId}`)))
      .then((rs) => {
        if (!alive) return
        if (rs.some((r) => r?.success === false)) return setDeliveries(null)
        setDeliveries(rs.reduce((n, r) => n + (r.updates ?? r.deliveries ?? []).length, 0))
      })
      .catch(() => alive && setDeliveries(null))
    return () => {
      alive = false
    }
  }, [profile])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading && !profile) return <ProfileSkeleton />
  if (!profile) {
    return <Empty icon="user" title={error ?? 'Profile not found'} sub="There is no one with that name yet." action={<Link href="/home" className="btn btn-secondary h-10 px-4.5 text-[13.5px]">Back home</Link>} />
  }

  const p = profile
  const totalUsd = solPrice ? p.totalDonated * solPrice : null
  const isSelf = address === p.address

  const share = () => {
    const text = own ? `My giving on @umanity_xyz: ${fmtSol(p.totalDonated, 2)} SOL to real people, held in escrow until it is delivered and proven.\n\n${origin}/u/${p.username}` : `${p.displayName || '@' + p.username} on @umanity_xyz\n\n${origin}/u/${p.username}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const invite = () => {
    navigator.clipboard.writeText(`${origin}/?ref=${p.username}`).then(() => toast('Invite link copied. When they give, you both earn points.', 'ok'))
  }

  return (
    <div className="max-w-[760px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 sm:gap-5">
        <Avatar username={p.username} url={p.avatarUrl} size={72} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[24px] font-bold tracking-[-0.02em] leading-tight truncate">{p.handleClaimed || !own ? p.displayName || `@${p.username}` : 'Your profile'}</h1>
            {p.foundingRank != null && p.foundingRank <= 100 && <Pill tone="green">Founding giver #{p.foundingRank}</Pill>}
          </div>
          <p className="text-[13.5px] text-[#6e6e73] mt-0.5">
            {p.handleClaimed || !own ? `@${p.username}` : 'No name yet'} · <span className="num">{p.followers}</span> followers · <span className="num">{p.following}</span> following
          </p>
          {p.bio && <p className="text-[14px] text-[#1d1d1f] mt-2 leading-relaxed">{p.bio}</p>}
          {own && !p.handleClaimed && (
            <Btn size="sm" className="mt-3" icon="spark" onClick={openProfileEditor}>
              Pick your name
            </Btn>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-5">
        {own ? (
          <>
            <Btn tone="outline" size="sm" icon="settings" onClick={openProfileEditor}>
              Edit profile
            </Btn>
            <Btn tone="outline" size="sm" icon="wallet" onClick={openWalletSheet}>
              Wallet
            </Btn>
            <Btn tone="outline" size="sm" icon="share" onClick={share}>
              Share
            </Btn>
            <Btn tone="outline" size="sm" icon="users" onClick={invite}>
              Invite
            </Btn>
            {isAdmin && (
              <Link href="/admin" className="btn btn-outline h-8 px-3.5 text-[12.5px]">
                <Icon name="truck" size={14} /> Field team console
              </Link>
            )}
          </>
        ) : (
          <>
            {!isSelf && <FollowButton profile={p} onChange={(f) => setProfile({ ...p, viewerFollows: f, followers: p.followers + (f ? 1 : -1) })} ensureSigner={ensureSigner} viewer={address} />}
            {isSelf && (
              <Link href="/profile" className="btn btn-outline h-8 px-3.5 text-[12.5px]">
                This is you · open your profile
              </Link>
            )}
            <Btn tone="outline" size="sm" icon="share" onClick={share}>
              Share
            </Btn>
            <Btn tone="outline" size="sm" icon="bolt" onClick={() => (window.location.href = `/home?compose=dare&target=${p.username}`)}>
              Dare {p.handleClaimed ? `@${p.username}` : 'them'}
            </Btn>
          </>
        )}
      </div>

      {/* Pass */}
      <div className="mt-6">
        <GuardianPass guardian={p.guardian} name={p.displayName || p.username} handle={p.username} address={p.address} foundingRank={p.foundingRank} />
      </div>

      {/* Impact */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4 mb-5">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">{own ? 'Your impact' : 'Impact'}</h2>
          {own && (
            <Btn size="sm" tone="accent" icon="heart" onClick={() => openGive()}>
              Give
            </Btn>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat label="Given" value={`${fmtSol(p.totalDonated, 2)} SOL`} sub={totalUsd != null ? fmtUsd(totalUsd) : `${p.donationCount} gifts`} size="sm" />
          <Stat label="Gifts" value={p.donationCount} sub={p.causes.length === 1 ? '1 cause' : `${p.causes.length} causes`} size="sm" />
          <Stat label="Points" value={p.rewardPoints.toLocaleString()} sub={`${p.votes} votes cast`} size="sm" />
          <Stat label="Streak" value={`${streak?.currentStreak ?? p.streakCurrent}d`} sub={`best ${streak?.longestStreak ?? p.streakLongest}d`} size="sm" />
        </div>
        {streak && <StreakDots days={streak.donationDays} className="mt-4" />}
        {deliveries != null && deliveries > 0 && (
          <p className="text-[13px] text-[#047857] mt-4 inline-flex items-center gap-1.5">
            <Icon name="truck" size={15} /> Helped fund <span className="num font-semibold">{deliveries}</span> {deliveries === 1 ? 'delivery' : 'deliveries'}
          </p>
        )}
        {p.causes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {p.causes.map((c) => (
              <Link key={c.poolId} href={`/causes/${c.poolId}`} className="flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border border-black/[0.08] bg-white hover:border-black/30 transition-colors">
                <span className="w-7 h-7 rounded-full overflow-hidden bg-black/[0.05] flex-shrink-0">{c.image ? <Img src={c.image.replace('w=1600', 'w=96')} alt="" /> : null}</span>
                <span className="text-[12.5px] font-semibold">{c.name}</span>
                <span className="text-[12px] text-[#6e6e73] num">{fmtSol(c.amount, 2)} SOL</span>
              </Link>
            ))}
          </div>
        )}
        {p.causes.length === 0 && own && <p className="text-[13.5px] text-[#6e6e73] mt-4">Your first gift starts the pass, the streak and the certificates. Five dollars is enough.</p>}
      </Card>

      {/* Tabs */}
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'gifts', label: `Gifts${p.gifts.length ? ` · ${p.gifts.length}` : ''}` },
            { value: 'certificates', label: `Certificates${p.certificates.length ? ` · ${p.certificates.length}` : ''}` },
            { value: 'dares', label: `Dares${p.dares.length ? ` · ${p.dares.length}` : ''}` },
            { value: 'posts', label: 'Posts' },
          ]}
        />
        <button onClick={reload} className="text-[#aeaeb2] hover:text-[#1d1d1f]" title="Refresh">
          <Icon name="refresh" size={16} />
        </button>
      </div>
      <div className="mt-4">
        {tab === 'gifts' && <Gifts gifts={p.gifts} solPrice={solPrice} own={own} onGive={() => openGive()} />}
        {tab === 'certificates' && <Certificates certs={p.certificates} />}
        {tab === 'dares' && <Dares dares={p.dares} username={p.username} />}
        {tab === 'posts' && <Posts posts={p.posts} />}
      </div>
      {own && user && user.address !== p.address && <p className="text-[12px] text-[#aeaeb2] mt-6">Signed in as a different wallet than this profile.</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function FollowButton({ profile, onChange, ensureSigner, viewer }: { profile: PublicProfile; onChange: (f: boolean) => void; ensureSigner: () => unknown; viewer: string | null }) {
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    const s = ensureSigner()
    if (!s || !viewer) return
    setBusy(true)
    const next = !profile.viewerFollows
    const r = await apiSend<{ success: boolean }>('/api/social/follow', { followerAddress: viewer, followeeAddress: profile.address }, next ? 'POST' : 'DELETE').catch(() => ({ success: false }))
    setBusy(false)
    if (r.success) onChange(next)
  }
  return (
    <Btn size="sm" tone={profile.viewerFollows ? 'secondary' : 'primary'} onClick={toggle} loading={busy} icon={profile.viewerFollows ? 'check' : 'plus'}>
      {profile.viewerFollows ? 'Following' : 'Follow'}
    </Btn>
  )
}

export function StreakDots({ days, className = '' }: { days: string[]; className?: string }) {
  const set = useMemo(() => new Set(days.map((d) => d.slice(0, 10))), [days])
  const cells = useMemo(() => {
    const out: { key: string; label: string; on: boolean; today: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      out.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), on: set.has(key), today: i === 0 })
    }
    return out
  }, [set])
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-1.5">
        {cells.map((c) => (
          <span key={c.key} title={c.key} className="flex flex-col items-center gap-1">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${c.on ? 'bg-[#10b981] text-white' : c.today ? 'border border-dashed border-black/20' : 'bg-black/[0.05]'}`}>{c.on && <Icon name="check" size={12} strokeWidth={2.5} />}</span>
            <span className="text-[10px] text-[#aeaeb2]">{c.label}</span>
          </span>
        ))}
      </div>
      <p className="text-[12px] text-[#6e6e73] leading-snug">Give any amount today to keep the streak alive.</p>
    </div>
  )
}

function Gifts({ gifts, solPrice, own, onGive }: { gifts: GiftView[]; solPrice: number | null; own: boolean; onGive: () => void }) {
  if (gifts.length === 0) {
    return (
      <Card>
        <Empty icon="heart" title={own ? 'No gifts yet' : 'No gifts yet'} sub={own ? 'Every gift is held in escrow until it is delivered and proven. Start with five dollars.' : 'Nothing given yet.'} action={own ? <Btn tone="accent" icon="heart" onClick={onGive}>Give</Btn> : undefined} />
      </Card>
    )
  }
  return (
    <div className="space-y-2 animate-stagger">
      {gifts.map((g) => {
        const c = getCause(g.poolId)
        return (
          <Card key={g.id} className="p-3.5 flex items-center gap-3.5">
            <Link href={`/causes/${g.poolId}`} className="w-12 h-12 rounded-2xl overflow-hidden bg-black/[0.05] flex-shrink-0">
              {c?.image ? <Img src={c.image.replace('w=1600', 'w=160')} alt={c.imageAlt} /> : null}
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{c?.name ?? g.poolName}</p>
              <p className="text-[12px] text-[#6e6e73] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{timeAgo(g.createdAt)}</span>
                {g.route === 'intents' && g.sourceChain && <Pill tone="gray">from {g.sourceChain.toUpperCase()} via NEAR Intents</Pill>}
                {g.route === 'multihopper' && <Pill tone="gray">private route</Pill>}
                {g.anonymous && <Pill tone="gray">anonymous</Pill>}
                <TxLink sig={g.signature} label="Receipt" />
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="num text-[15px] font-bold">{fmtSol(g.amount, 3)} SOL</p>
              {solPrice && <p className="num text-[12px] text-[#6e6e73]">{fmtUsd(g.amount * solPrice)}</p>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

const CERT_TONES: Record<string, { bg: string; ink: string; ring: string }> = {
  bronze: { bg: '#f3ebe3', ink: '#6b4f3a', ring: '#d9c3ad' },
  silver: { bg: '#eef0f2', ink: '#4f565c', ring: '#c9ced3' },
  gold: { bg: '#f7f1dc', ink: '#705b1f', ring: '#e2d39f' },
  diamond: { bg: '#e8f3f6', ink: '#2b5f6e', ring: '#b9dbe4' },
}

function Certificates({ certs }: { certs: CertView[] }) {
  if (certs.length === 0) {
    return (
      <Card>
        <Empty icon="trophy" title="No certificates yet" sub="Each gift mints an impact certificate: bronze, silver from 0.1 SOL, gold from 0.5 SOL, diamond from 1 SOL." />
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-stagger">
      {certs.map((c) => {
        const t = CERT_TONES[c.tier] ?? CERT_TONES.bronze
        const cause = c.poolId ? getCause(c.poolId) : undefined
        return (
          <div key={c.id} className="rounded-[22px] p-4 flex flex-col min-h-[150px]" style={{ background: t.bg, color: t.ink, border: `1px solid ${t.ring}` }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">{c.tier}</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.6)' }}>
                <Icon name="trophy" size={14} />
              </span>
            </div>
            <p className="num text-[22px] font-bold mt-4 leading-none">{fmtSol(c.amount, 3)} SOL</p>
            <p className="text-[12.5px] mt-1.5 font-medium truncate">{cause?.name ?? c.causeName}</p>
            <div className="mt-auto pt-3 flex items-center justify-between text-[11px] opacity-80">
              <span>{new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {c.signature && <TxLink sig={c.signature} label="Proof" className="!text-current" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Dares({ dares, username }: { dares: DareView[]; username: string }) {
  if (dares.length === 0) {
    return (
      <Card>
        <Empty icon="bolt" title="No dares yet" sub="Dare a friend to match a gift and stake SOL on it. Whether they deliver or not, the cause wins." />
      </Card>
    )
  }
  return (
    <div className="space-y-2 animate-stagger">
      {dares.map((d) => (
        <DareRow key={d.id} dare={d} username={username} />
      ))}
    </div>
  )
}

function DareRow({ dare, username }: { dare: DareView; username: string }) {
  const left = useCountdown(dare.secondsLeft)
  const mine = dare.creator.username === username
  const open = dare.status === 'open'
  return (
    <Link href={`/dares/${dare.id}`} className="card card-hover p-4 flex items-center gap-4 block">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${open ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-black/[0.05] text-[#6e6e73]'}`}>
        <Icon name="bolt" size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold truncate">
          {mine ? `You dared @${dare.targetHandle}` : `@${dare.creator.username} dared you`}
        </p>
        <p className="text-[12.5px] text-[#6e6e73] truncate mt-0.5">
          {dare.text} · {dare.poolName}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="num text-[14px] font-bold">{fmtSol(dare.pot, 3)} SOL</p>
        <p className="text-[11.5px] text-[#6e6e73]">{open ? countdown(left) : dare.status}</p>
      </div>
    </Link>
  )
}

function Posts({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) {
    return (
      <Card>
        <Empty icon="chat" title="Nothing posted yet" sub="Gifts, dares and votes show up here automatically." />
      </Card>
    )
  }
  return (
    <div className="space-y-2 animate-stagger">
      {posts.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73]">
            <span className="capitalize">{p.type.replace('_', ' ')}</span>
            <span>·</span>
            <span>{timeAgo(p.createdAt)}</span>
            {p.txSignature && <TxLink sig={p.txSignature} label="Receipt" />}
          </div>
          <p className="text-[14px] mt-1.5 leading-relaxed whitespace-pre-wrap">{p.content}</p>
          <p className="text-[12px] text-[#aeaeb2] mt-2 inline-flex items-center gap-1.5">
            <Icon name="heart" size={13} /> <span className="num">{p.likeCount}</span>
            <Icon name="chat" size={13} className="ml-2" /> <span className="num">{p.commentCount}</span>
          </p>
        </Card>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex items-start gap-5">
        <Skeleton className="w-[72px] h-[72px] !rounded-full" />
        <div className="flex-1 space-y-2 pt-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-[220px] mt-8 !rounded-[28px]" />
      <Skeleton className="h-[160px] mt-4 !rounded-[20px]" />
      <Skeleton className="h-10 w-80 mt-6 !rounded-full" />
      <Skeleton className="h-[72px] mt-4 !rounded-[20px]" />
      <Skeleton className="h-[72px] mt-2 !rounded-[20px]" />
    </div>
  )
}
