'use client'

import { useEffect, useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, fmtSol, fmtUsd, timeAgo, short } from '@/lib/client/api'
import { Card, Btn, Pill, Mono, TxLink, Skeleton, Empty } from '@/components/shared/ui'
import { GradientAvatar } from '@/components/shared/GradientAvatar'
import { guardianFor, TIER_COLORS, TIERS, type GuardianState } from '@/lib/guardian'
import { CAUSES } from '@/lib/causes'
import type { DareView } from '@/lib/data/dares'

interface Cert {
  id: string
  tier: string
  cause_name: string
  amount: number
  mint_signature: string | null
  created_at: string
}

interface Score {
  guardian: GuardianState
  breakdown: { points: number; donated: number; donations: number; streak: number; longestStreak: number; votes: number; followers: number; following: number } | null
}

interface IntentRow {
  id: string
  status: string
  sourceChain: string
  sourceAsset: string
  sourceAmount: string | null
  poolId: string | null
  settlementSignature: string | null
  createdAt: string
}

export function ProfileTab({ onClaim }: { onClaim: () => void }) {
  const { user, address, signer, solPrice, startDemo, toast } = useUmanity()
  const [score, setScore] = useState<Score | null>(null)
  const [certs, setCerts] = useState<Cert[] | null>(null)
  const [dares, setDares] = useState<DareView[]>([])
  const [intents, setIntents] = useState<IntentRow[]>([])
  const [sub, setSub] = useState<'holdings' | 'receipts' | 'blinks'>('holdings')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (!address) return
    apiGet<Score>(`/api/impact-score?address=${address}`).then(setScore).catch(() => {})
    apiGet<{ nfts?: Cert[] }>(`/api/nft/gallery?address=${address}`).then((r) => setCerts(r.nfts ?? [])).catch(() => setCerts([]))
    apiGet<{ dares?: DareView[] }>('/api/dares?limit=50').then((r) => setDares((r.dares ?? []).filter((d) => d.creator.address === address || d.targetHandle === user?.username))).catch(() => {})
    apiGet<{ intents?: IntentRow[] }>(`/api/intents/recent?address=${address}`).then((r) => setIntents(r.intents ?? [])).catch(() => {})
  }, [address, user?.username])

  if (!address || !user) {
    return (
      <div className="max-w-[640px] mx-auto">
        <Empty
          title="Your Living Guardian pass starts here"
          sub="Connect a wallet or start an instant demo wallet. Your pass evolves with every donation, dare and vote."
          action={
            <Btn tone="emerald" onClick={() => startDemo().then((r) => (r.error ? toast(r.error, 'err') : toast('Demo wallet ready', 'ok')))}>
              ⚡ Start demo wallet
            </Btn>
          }
        />
      </div>
    )
  }

  const g = score?.guardian ?? guardianFor({ rewardPoints: user.rewardPoints, streakCurrent: user.streakCurrent, donationCount: user.donationCount })
  const colors = TIER_COLORS[g.tier]
  const dark = g.tier === 'Sovereign'
  const refLink = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${user.username}`
  const copy = (text: string, key: string) => navigator.clipboard.writeText(text).then(() => {
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  })

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Profile & Pass</h2>
          <p className="text-[13px] text-[#52525B]">Your impact identity, on-chain and evolving.</p>
        </div>
        <Btn size="sm" tone="outline" onClick={onClaim}>
          {user.handleClaimed ? 'Edit profile' : '✨ Claim @handle'}
        </Btn>
      </div>

      {/* Living Guardian card */}
      <div className="relative rounded-[28px] p-6 overflow-hidden border border-[#ECECED] shadow-[0_12px_40px_rgba(0,0,0,0.08)]" style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-30 blur-2xl" style={{ background: colors.accent }} />
        <div className="relative flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-white/70 backdrop-blur flex items-center justify-center text-4xl shadow-inner">{colors.glyph}</div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${dark ? 'text-white/60' : 'text-[#52525B]'}`}>Living Impact Guardian · Tier {g.level}</p>
            <h3 className={`text-[26px] font-bold tracking-tight ${dark ? 'text-white' : 'text-[#111113]'}`}>{g.tier}</h3>
            <p className={`text-[13px] ${dark ? 'text-white/80' : 'text-[#52525B]'}`}>
              {user.displayName} · @{user.username} · <Mono>{short(address)}</Mono> {signer?.kind === 'demo' && <Pill tone="emerald">demo</Pill>}
            </p>
            <div className="mt-3 h-2 rounded-full bg-black/[0.08] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(g.progress * 100)}%`, background: colors.accent }} />
            </div>
            <p className={`text-[11px] mt-1 ${dark ? 'text-white/70' : 'text-[#52525B]'}`}>
              <Mono>{g.score.toLocaleString()}</Mono> guardian score {g.nextTier ? `· ${g.pointsToNext.toLocaleString()} to ${g.nextTier}` : '· max tier'}
            </p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            ['🔥 Streak', `${user.streakCurrent}d`, `best ${user.streakLongest}d`],
            ['Given', `${fmtSol(user.totalDonated, 3)} SOL`, solPrice ? fmtUsd(user.totalDonated * solPrice) : `${user.donationCount} donations`],
            ['Impact points', user.rewardPoints.toLocaleString(), 'voting power'],
            ['Perks', `${g.feeRebateBps / 100}% rebate`, `${g.dareBoostMultiplier}x dare pts`],
          ].map(([l, v, s]) => (
            <div key={l} className="rounded-2xl bg-white/60 backdrop-blur p-3">
              <p className="text-[10px] text-[#52525B]">{l}</p>
              <Mono className="block text-[15px] font-bold text-[#111113]">{v}</Mono>
              <p className="text-[10px] text-[#52525B]">{s}</p>
            </div>
          ))}
        </div>
        <div className="relative flex gap-1.5 mt-4 flex-wrap">
          {TIERS.map((t, i) => (
            <span key={t.tier} className={`text-[10px] px-2 py-1 rounded-full ${i + 1 <= g.level ? 'bg-[#111113] text-white' : 'bg-white/60 text-[#52525B]'}`}>
              {TIER_COLORS[t.tier].glyph} {t.tier}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-[#F3F3F1] rounded-xl p-1 w-fit my-4">
        {(
          [
            ['holdings', 'Holdings'],
            ['receipts', 'On-chain receipts'],
            ['blinks', 'Shareable Blinks'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${sub === id ? 'bg-white shadow-sm' : 'text-[#52525B]'}`}>
            {label}
          </button>
        ))}
      </div>

      {sub === 'holdings' && (
        <div className="space-y-3">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[14px]">Impact certificates</h4>
              <Pill tone="amber">{certs?.length ?? 0} soulbound</Pill>
            </div>
            {certs === null ? (
              <Skeleton className="h-20" />
            ) : certs.length === 0 ? (
              <p className="text-[12px] text-[#52525B]">Your first donation mints a Bronze certificate tied to its transaction.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {certs.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-[#ECECED] p-3 text-center">
                    <span className="text-2xl">{c.tier === 'diamond' ? '💎' : c.tier === 'gold' ? '🥇' : c.tier === 'silver' ? '🥈' : '🥉'}</span>
                    <p className="text-[11px] font-semibold capitalize mt-1">{c.tier}</p>
                    <p className="text-[10px] text-[#52525B] truncate">{c.cause_name}</p>
                    <Mono className="text-[10px]">{fmtSol(c.amount, 3)} SOL</Mono>
                    <div className="mt-1">{c.mint_signature && <TxLink sig={c.mint_signature} label="tx" />}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h4 className="font-bold text-[14px] mb-3">Dares you are in</h4>
            {dares.length === 0 ? (
              <p className="text-[12px] text-[#52525B]">No dares yet. Launch one from the feed.</p>
            ) : (
              <div className="space-y-2">
                {dares.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      {d.creator.address === address ? 'You dared' : 'Dared by'} <b>@{d.creator.address === address ? d.targetHandle : d.creator.username}</b>: {d.text}
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <Mono className="font-semibold text-[#D9431F]">{fmtSol(d.pot, 3)} SOL</Mono>
                      <Pill tone={d.status === 'open' ? 'coral' : 'gray'}>{d.status}</Pill>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[14px]">Invite friends</h4>
              {score?.breakdown && <span className="text-[11px] text-[#52525B]">{score.breakdown.followers} followers · {score.breakdown.following} following</span>}
            </div>
            <div className="flex gap-2">
              <Mono className="flex-1 min-w-0 truncate text-[12px] bg-[#F3F3F1] rounded-xl px-3 py-2.5">{refLink}</Mono>
              <Btn size="md" onClick={() => copy(refLink, 'ref')}>
                {copied === 'ref' ? 'Copied' : 'Copy'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {sub === 'receipts' && (
        <Card className="p-5">
          <h4 className="font-bold text-[14px] mb-3">Every record, on Solscan</h4>
          {certs === null ? (
            <Skeleton className="h-20" />
          ) : (
            <div className="space-y-2">
              {certs.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#F3F3F1] last:border-0">
                  <span>
                    <Mono className="font-semibold">{fmtSol(c.amount, 3)} SOL</Mono> → {c.cause_name} <span className="text-[#A1A1AA]">· {timeAgo(c.created_at)}</span>
                  </span>
                  {c.mint_signature && <TxLink sig={c.mint_signature} label="DonationRecord ↗" />}
                </div>
              ))}
              {intents.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#F3F3F1] last:border-0">
                  <span>
                    <Pill tone="indigo">{i.sourceChain.toUpperCase()}</Pill> {i.sourceAmount} {i.sourceAsset} → {CAUSES.find((c) => c.id === i.poolId)?.shortName ?? 'cause'} <span className="text-[#A1A1AA]">· {i.status} · {timeAgo(i.createdAt)}</span>
                  </span>
                  {i.settlementSignature && (
                    <a href={`https://solscan.io/tx/${i.settlementSignature}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-700 hover:underline">
                      mainnet tx ↗
                    </a>
                  )}
                </div>
              ))}
              {certs.length === 0 && intents.length === 0 && <p className="text-[12px] text-[#52525B]">Nothing yet.</p>}
            </div>
          )}
        </Card>
      )}

      {sub === 'blinks' && (
        <Card className="p-5">
          <h4 className="font-bold text-[14px] mb-1">Shareable Blinks</h4>
          <p className="text-[12px] text-[#52525B] mb-3">Paste on X. Anyone donates from the timeline, straight into escrow.</p>
          <div className="space-y-2">
            {CAUSES.map((c) => {
              const action = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/actions/donate/${c.id}`
              const blink = `https://dial.to/?action=solana-action:${encodeURIComponent(action)}&cluster=devnet`
              return (
                <div key={c.id} className="flex items-center gap-3 text-[12px]">
                  <span className="w-7 text-center text-lg">{c.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{c.shortName}</span>
                  <Btn size="sm" tone="secondary" onClick={() => copy(blink, c.id)}>
                    {copied === c.id ? 'Copied' : 'Copy Blink'}
                  </Btn>
                  <a href={blink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-700 hover:underline">
                    preview ↗
                  </a>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
