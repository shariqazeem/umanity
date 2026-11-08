'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'
import { explorerAccount, explorerTx } from '@/lib/solana/constants'
import { usdcAccount } from '@/lib/umanity/usdc'
import { amountInUnits, plural, usdText } from '@/lib/umanity/drops'
import type { DropDetail, DropView } from '@/lib/umanity/data'
import { short, timeAgo } from '@/lib/client/api'
import { Avatar } from '@/components/shared/ui'

/** Drops are numbered from 1 for people; the chain counts from 0. */
export const dropHref = (id: number) => `/drops/${id + 1}`

export const STATE_LABEL: Record<DropView['state'], string> = {
  open: 'Filling',
  proven: 'Checking',
  unlocked: 'Delivered',
  cancelled: 'Refunding',
}

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const dayText = (unixSecs: number) => dayFmt.format(new Date(unixSecs * 1000))
export const whenText = (unixSecs: number) => timeFmt.format(new Date(unixSecs * 1000))

export function StatePill({ drop }: { drop: Pick<DropView, 'state' | 'refundsOpen'> }) {
  const refunding = drop.state === 'cancelled' || drop.refundsOpen
  const tone = refunding ? 'bg-amber-50 text-amber-700' : drop.state === 'unlocked' ? 'bg-emerald-50 text-emerald-700' : drop.state === 'proven' ? 'bg-blue-50 text-blue-700' : 'bg-black/[0.04] text-[#525252]'
  return (
    <span className={`pill ${tone} !text-[10px] font-semibold`}>
      {drop.state === 'open' && !refunding && <span className="pulse-dot !w-1.5 !h-1.5 mr-1" />}
      {refunding ? 'Refunding' : STATE_LABEL[drop.state]}
    </span>
  )
}

/** The pot, in dollars and in the real things it buys. */
export function DropMeter({ drop, size = 'lg' }: { drop: DropView; size?: 'sm' | 'lg' }) {
  // After unlocking the pot is empty: count what was delivered instead.
  const delivered = drop.state === 'unlocked'
  const amount = delivered ? drop.unlockedUsd : drop.potUsd
  const { whole, people } = amountInUnits(amount, drop.unit)
  const pct = delivered ? Math.round(Math.min(1, amount / drop.goalUsd) * 100) : Math.round(drop.progress * 100)
  const big = size === 'lg'
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className={`${big ? 'text-[34px] md:text-[40px]' : 'text-[22px]'} font-black tracking-[-0.03em] leading-none counter`}>
          {usdText(amount)}
          <span className={`${big ? 'text-[15px]' : 'text-[12px]'} font-semibold text-[#86868b] tracking-normal ml-1.5`}>{delivered ? 'delivered' : `of ${usdText(drop.goalUsd)}`}</span>
        </p>
        <p className={`${big ? 'text-[13px]' : 'text-[11px]'} font-semibold text-[#86868b] counter`}>{pct}%</p>
      </div>
      <div className={`progress emerald ${big ? 'mt-3' : 'mt-2'}`}>
        <span style={{ width: `${Math.max(pct, amount > 0 ? 2 : 0)}%` }} />
      </div>
      <p className={`${big ? 'text-[13px]' : 'text-[11.5px]'} text-[#525252] mt-2`}>
        {whole > 0 ? (
          <>
            <span className="font-semibold text-[#1d1d1f]">{plural(whole, drop.unit.name)}</span> {delivered ? 'delivered' : 'so far'}
            {drop.unit.people > 0 && <> · {plural(people, 'person', 'people')} helped</>}
          </>
        ) : (
          <>Every {usdText(drop.unit.usd)} is one {drop.unit.name}: {drop.unit.covers}</>
        )}
        {drop.backers > 0 && <span className="text-[#86868b]"> · {plural(drop.backers, 'backer')}</span>}
      </p>
    </div>
  )
}

type Step = { title: string; sub: ReactNode; state: 'done' | 'now' | 'next'; tx?: string | null }

function steps(d: DropDetail, reviewHours: number): Step[] {
  const tx = (kind: string) => d.timeline.find((t) => t.kind === kind)?.signature ?? null
  const proven = d.proofAt != null
  const reviewEnds = d.proofAt ? d.proofAt + reviewHours * 3600 : null
  const checked = d.state === 'unlocked' || (reviewEnds != null && Date.now() / 1000 >= reviewEnds)
  return [
    {
      title: 'Pot filling',
      sub: proven ? `${usdText(d.givenUsd + d.fromFundUsd)} from ${plural(d.backers, 'backer')}` : `Open until ${whenText(d.deadline)}`,
      state: proven || d.state !== 'open' ? 'done' : 'now',
      tx: d.createdTx,
    },
    {
      title: 'Delivered and filmed',
      sub: proven ? `Proof posted ${whenText(d.proofAt!)}` : 'The team posts the video, photos and receipts',
      state: proven ? 'done' : d.state === 'open' ? 'next' : 'next',
      tx: tx('proofPosted'),
    },
    {
      title: 'Checked',
      sub: reviewEnds ? (checked ? `Check finished ${whenText(reviewEnds)}` : `Check ends ${whenText(reviewEnds)}`) : `${reviewHours}-hour check after the proof`,
      state: checked ? 'done' : proven ? 'now' : 'next',
    },
    {
      title: 'Unlocked',
      sub: d.state === 'unlocked' ? `${usdText(d.unlockedUsd)} paid ${d.unlockedAt ? whenText(d.unlockedAt) : ''}` : 'The pot pays for the delivered goods',
      state: d.state === 'unlocked' ? 'done' : checked ? 'now' : 'next',
      tx: d.unlockTx,
    },
  ]
}

/** Filling → Delivered and filmed → Checked → Unlocked, each with its transaction. */
export function DropSteps({ drop, reviewHours }: { drop: DropDetail; reviewHours: number }) {
  if (drop.state === 'cancelled' || drop.refundsOpen) {
    return (
      <div className="rounded-2xl bg-amber-50/70 border border-amber-100 p-4">
        <p className="text-[14px] font-semibold text-amber-900">Every backer is getting their money back</p>
        <p className="text-[12.5px] text-amber-800/80 mt-1">
          {drop.state === 'cancelled' ? 'This drop was called off.' : `It wasn't proven by ${whenText(drop.deadline)}.`} Refunds go straight to each backer&apos;s wallet. {usdText(drop.refundedUsd)} returned so far.
        </p>
      </div>
    )
  }
  return (
    <ol className="relative">
      {steps(drop, reviewHours).map((s, i, all) => (
        <li key={s.title} className="flex gap-3.5 pb-4 last:pb-0 relative">
          {i < all.length - 1 && <span className={`absolute left-[11px] top-6 bottom-0 w-px ${s.state === 'done' ? 'bg-emerald-300' : 'bg-black/[0.08]'}`} />}
          <span
            className={`w-[23px] h-[23px] rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
              s.state === 'done' ? 'bg-emerald-500 text-white' : s.state === 'now' ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.05] text-[#aeaeb2]'
            }`}
          >
            {s.state === 'done' ? '✓' : i + 1}
          </span>
          <div className="min-w-0 -mt-0.5">
            <p className={`text-[14px] font-semibold ${s.state === 'next' ? 'text-[#aeaeb2]' : ''}`}>{s.title}</p>
            <p className="text-[12px] text-[#86868b]">
              {s.sub}
              {s.tx && (
                <a href={explorerTx(s.tx)} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-emerald-700 font-semibold hover:underline">
                  tx ↗
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DropCard({ drop }: { drop: DropView }) {
  return (
    <Link href={dropHref(drop.id)} className="card card-interactive p-4 flex gap-4 items-start">
      <div className="w-12 h-12 rounded-[16px] bg-[#f5f5f7] flex items-center justify-center text-[24px] flex-shrink-0">{drop.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-[0.1em]">
            Drop #{drop.id + 1} · {dayText(drop.deadline)}
          </p>
          <StatePill drop={drop} />
        </div>
        <p className="text-[15px] font-bold tracking-tight mt-0.5 truncate">{drop.title}</p>
        <p className="text-[12px] text-[#86868b] truncate">📍 {drop.place}</p>
        <div className="mt-3">
          <DropMeter drop={drop} size="sm" />
        </div>
      </div>
    </Link>
  )
}

export function Backers({ gifts }: { gifts: DropDetail['gifts'] }) {
  if (!gifts.length) return <p className="text-[13px] text-[#86868b]">No gifts yet. Be the first name in this drop&apos;s video.</p>
  return (
    <ul className="divide-y divide-black/[0.04]">
      {gifts.map((g) => {
        const profile = g.who && 'username' in g.who && g.who.username ? g.who : null
        const address = g.who && 'address' in g.who ? g.who.address : null
        const name = profile ? `@${profile.username}` : address ? short(address) : 'Someone'
        return (
          <li key={g.ref} className="flex items-center gap-3 py-2.5">
            <Avatar username={profile?.username ?? name} url={profile?.avatarUrl ?? null} size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">
                {name}
                {g.channel !== 'wallet' && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">{channelLabel(g.channel, g.sourceChain)}</span>}
              </p>
              {g.message && <p className="text-[12px] text-[#525252] truncate">“{g.message}”</p>}
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold counter">{usdText(g.amountUsd)}</p>
              {g.signature ? (
                <a href={explorerTx(g.signature)} target="_blank" rel="noopener noreferrer" className="text-[10.5px] text-[#86868b] hover:text-[#1d1d1f]">
                  {timeAgo(g.at)} ↗
                </a>
              ) : (
                <p className="text-[10.5px] text-[#86868b]">{timeAgo(g.at)}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function channelLabel(channel: string, sourceChain: string | null) {
  if (channel === 'x402') return 'AI agent'
  if (channel === 'intents') return sourceChain ? `from ${sourceChain}` : 'cross-chain'
  if (channel === 'welcome') return 'first gift'
  if (channel === 'fund') return 'from trading fees'
  return channel
}

/** The rules, in plain words, with the numbers this drop runs on. */
export function MoneyRules({ drop, reviewHours }: { drop: DropView; reviewHours: number }) {
  return (
    <ul className="space-y-2.5">
      {[
        ['🔒', `Your gift goes into this drop's own pot on Solana, in USDC.`],
        ['🎥', `The pot pays out only after proof of the delivery is posted on-chain and a ${reviewHours}-hour check passes, and only to the delivery wallet fixed when the drop was created.`],
        ['↩️', `If it isn't proven by ${whenText(drop.deadline)}, every backer gets back exactly what they gave.`],
        ['💯', '100% of gifts go to the drop. Umanity earns from trading fees, never from gifts.'],
        ['ℹ️', 'Umanity is a crypto app, not a registered charity, and gifts are not tax-deductible.'],
      ].map(([icon, text]) => (
        <li key={text} className="flex gap-3 text-[13px] leading-relaxed text-[#525252]">
          <span className="w-5 text-center flex-shrink-0">{icon}</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

export function ChainFacts({ drop }: { drop: DropDetail }) {
  const rows: [string, ReactNode][] = [
    ['Drop account', <a key="d" href={explorerAccount(drop.address)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">{short(drop.address, 6)} ↗</a>],
    ['Pot (USDC)', <a key="p" href={explorerAccount(usdcAccount(new PublicKey(drop.address)).toBase58())} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">{usdText(drop.potUsd, 2)} ↗</a>],
    ['Pays out to', <a key="w" href={explorerAccount(drop.payee)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">{short(drop.payee, 6)} ↗</a>],
    ['Cap', usdText(drop.capUsd)],
    [
      'Description',
      <span key="h" className={drop.metaVerified ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
        {drop.metaVerified ? '✓ matches the on-chain hash' : '✗ does not match the chain'}
      </span>,
    ],
  ]
  return (
    <dl className="divide-y divide-black/[0.04] text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-2">
          <dt className="text-[#86868b]">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

type TicketDrop = Pick<DropView, 'id' | 'title' | 'emoji' | 'place' | 'state' | 'refundsOpen' | 'deadline' | 'unit'>

/** Where a gift is: in the pot, filmed, delivered, or refunded. Also used on the dark done screen. */
export function giftStage(drop: Pick<DropView, 'state' | 'refundsOpen'>, refundedUsd = 0) {
  if (drop.refundsOpen || refundedUsd > 0) return { steps: ['In the pot', refundedUsd > 0 ? 'Refunded' : 'Refunding'], done: refundedUsd > 0 ? 2 : 1, refund: true }
  const done = drop.state === 'unlocked' ? 3 : drop.state === 'proven' ? 2 : 1
  return { steps: ['In the pot', 'Filmed', 'Delivered'], done, refund: false }
}

/** A gift as a ticket that follows its drop to the delivery video, or back to the giver. */
export function GiftTicket({ drop, amountUsd, refundedUsd = 0 }: { drop: TicketDrop; amountUsd: number; refundedUsd?: number }) {
  const stage = giftStage(drop, refundedUsd)
  const { whole } = amountInUnits(amountUsd, drop.unit)
  const line = stage.refund
    ? refundedUsd > 0
      ? `${usdText(refundedUsd, 2)} came back to your wallet.`
      : drop.state === 'cancelled'
        ? 'Called off before delivery. Your money is on its way back.'
        : 'It missed its date. Your money is on its way back.'
    : drop.state === 'unlocked'
      ? 'Delivered and filmed.'
      : drop.state === 'proven'
        ? 'The delivery is filmed and being checked.'
        : `Pays on filmed proof. Refunded if it misses ${dayText(drop.deadline)}.`
  return (
    <Link href={dropHref(drop.id)} className="card p-4 block hover:border-black/[0.1] transition-colors">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-[14px] bg-[#f5f5f7] flex items-center justify-center text-[20px] flex-shrink-0">{drop.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold truncate">{drop.title}</span>
          <span className="block text-[12px] text-[#86868b] truncate">
            {usdText(amountUsd, amountUsd % 1 ? 2 : 0)}
            {whole > 0 ? ` · ${plural(whole, drop.unit.name)}` : ''} · {drop.place}
          </span>
        </span>
        <StatePill drop={drop} />
      </div>
      <div className="flex items-center gap-1.5 mt-3.5" aria-label={`${stage.steps[stage.done - 1]}, step ${stage.done} of ${stage.steps.length}`}>
        {stage.steps.map((label, i) => (
          <div key={label} className="flex-1 min-w-0">
            <div className={`h-1 rounded-full ${i < stage.done ? (stage.refund && i > 0 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-black/[0.06]'}`} />
            <p className={`text-[11px] mt-1.5 truncate ${i < stage.done ? 'text-[#1d1d1f] font-semibold' : 'text-[#aeaeb2]'}`}>{label}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[#525252] mt-2">{line}</p>
    </Link>
  )
}
