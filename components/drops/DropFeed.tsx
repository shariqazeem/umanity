'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Img } from '@/components/shared/ui'
import { Composer } from '@/components/feed/Composer'
import { PostCard } from '@/components/feed/PostCard'
import { chainLabel } from '@/components/feed/types'
import { apiGet, short } from '@/lib/client/api'
import { shownName } from '@/lib/client/names'
import { explorerTx } from '@/lib/solana/constants'
import { amountInUnits, helpedText, plural, usdText } from '@/lib/umanity/drops'
import type { FeedDrop, FeedWho, HomeItem } from '@/lib/umanity/feed'
import type { FeedPost } from '@/lib/data/social'
import { pickNextDrop, useDrops } from './hooks'
import { useSeed } from './seed'
import { dropHref } from './DropParts'
import { Ago } from '@/components/shared/Ago'
import { StateIcon } from '@/components/shared/ProofOrb'

const FILTERS = [
  { key: 'all', label: 'For you' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'gifts', label: 'Gifts' },
  { key: 'money', label: 'Money' },
] as const
type Filter = (typeof FILTERS)[number]['key']

const shows = (it: HomeItem, f: Filter) =>
  f === 'all' ||
  (f === 'deliveries' && (it.type === 'update' || it.type === 'unlocked' || it.type === 'missed')) ||
  (f === 'gifts' && (it.type === 'gift' || it.type === 'fundGift')) ||
  (f === 'money' && (it.type === 'fees' || it.type === 'funded' || it.type === 'unlocked' || it.type === 'missed'))

/** Home's stream: what happened to drops, from the chain, plus people's posts. */
export function DropFeed() {
  const { address } = useUmanity()
  const { data: drops } = useDrops()
  const next = pickNextDrop(drops)
  const seed = useSeed()
  const [items, setItems] = useState<HomeItem[] | null>(seed.feed ?? null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ items?: HomeItem[] }>(`/api/feed/drops${address ? `?address=${address}` : ''}`)
      setItems(d.items ?? [])
      setFailed(false)
    } catch {
      setItems((prev) => prev ?? [])
      setFailed(true)
    }
  }, [address])

  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  const dare = () => {
    const where = next ? `${window.location.origin}${dropHref(next.id)}` : window.location.origin
    const what = next ? `${next.title} (${next.place})` : 'the next Umanity drop'
    const text = `I'm putting money into ${what} on @umanity_xyz. It only pays out once the delivery is filmed and checked, and comes back if it isn't.\n\nI dare you to match me:\n${where}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const visible = (items ?? []).filter((it) => shows(it, filter))
  const teamGifts = visible.filter((it): it is Extract<HomeItem, { type: 'gift' | 'fundGift' }> => (it.type === 'gift' || it.type === 'fundGift') && it.team)
  const firstTeamGift = teamGifts[teamGifts.length - 1]?.id

  return (
    <div>
      <div className="mb-4 pt-2">
        <h2 className="text-2xl font-bold tracking-[-0.02em] mb-0.5">Feed</h2>
        <p className="text-[#4F5B5E] text-[13px]">Every gift, delivery and payout, as it happens on Solana.</p>
      </div>

      {/* Guests read the feed; the header already offers Sign in. */}
      {address && (
        <div className="mb-3">
          <Composer onPosted={(post: FeedPost) => setItems((it) => [{ type: 'post', id: `post_${post.id}`, at: post.createdAt, post }, ...(it ?? [])])} onDare={dare} />
        </div>
      )}

      {/* Room inside the scroller for the chips' larger touch areas, so nothing clips or scrolls vertically. */}
      <div className="flex gap-1.5 mb-1.5 overflow-x-auto no-scrollbar py-1.5 -mt-1.5 px-0.5 -mx-0.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`hit h-9 px-3.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'bg-[#111111] text-white' : 'bg-white border border-black/[0.04] text-[#4F5B5E] hover:text-[#111111]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-[20px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[#E8EDEE] flex items-center justify-center mx-auto mb-3">
            <StateIcon state="open" size={28} />
          </div>
          <p className="text-[#111111] font-semibold text-[15px] mb-1">{failed ? 'The feed could not load' : filter === 'all' ? 'Nothing has happened yet' : 'Nothing here yet'}</p>
          <p className="text-[#4F5B5E] text-[13px] mb-5 max-w-sm mx-auto">{failed ? 'It will retry on its own.' : 'Every gift, filmed delivery and payout lands here with its transaction.'}</p>
          <Link href="/give" className="btn-primary px-5 py-2.5 text-[13px]">
            {next ? 'Fill the next drop' : 'Give to the fund'}
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 animate-stagger">
          {visible.map((it) => {
            if ((it.type === 'gift' || it.type === 'fundGift') && it.team) {
              return it.id === firstTeamGift ? <TeamGiftsCard key="team-gifts" gifts={teamGifts.length} usd={teamGifts.reduce((s, g) => s + g.amountUsd, 0)} /> : null
            }
            switch (it.type) {
              case 'gift':
                return <GiftCard key={it.id} item={it} />
              case 'update':
                return <UpdateCard key={it.id} item={it} />
              case 'unlocked':
                return <UnlockedCard key={it.id} item={it} />
              case 'missed':
                return <MissedCard key={it.id} item={it} />
              case 'fees':
                return <FeesCard key={it.id} item={it} />
              case 'funded':
                return <FundedCard key={it.id} item={it} />
              case 'fundGift':
                return <FundGiftCard key={it.id} item={it} />
              case 'post':
                return <PostCard key={it.id} post={it.post} />
            }
          })}
        </div>
      )}
    </div>
  )
}

function whoName(who: FeedWho) {
  if (!who) return { name: 'Someone', handle: null, href: null, avatar: null, seed: 'anon' }
  if ('address' in who) return { name: short(who.address), handle: null, href: null, avatar: null, seed: who.address }
  return { name: shownName(who.displayName, who.username) ?? `@${who.username}`, handle: shownName(who.displayName, who.username) ? `@${who.username}` : null, href: `/u/${who.username}`, avatar: who.avatarUrl, seed: who.username }
}

const CHANNEL: Record<string, string> = { wallet: 'Gift', welcome: 'Welcome gift', x402: 'Agent · x402', intents: 'Any chain', fund: 'From fees' }

function DropLine({ drop }: { drop: FeedDrop }) {
  return (
    <Link href={dropHref(drop.id)} className="font-semibold hover:underline">
      Drop #{drop.id + 1} · {drop.title}
    </Link>
  )
}

function GiftCard({ item }: { item: Extract<HomeItem, { type: 'gift' }> }) {
  const { openGive } = useUmanity()
  const w = whoName(item.who)
  const { units, people } = amountInUnits(item.amountUsd, { name: item.drop.unitName, usd: item.drop.unitUsd, people: item.drop.people, covers: '' })
  const chain = item.channel === 'intents' ? chainLabel(item.sourceChain) : null
  const head = (
    <>
      <Avatar username={w.seed} url={w.avatar} size={40} />
    </>
  )
  return (
    <article className="card p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        {w.href ? <Link href={w.href}>{head}</Link> : head}
        <div className="flex-1 min-w-0">
          {w.href ? (
            <Link href={w.href} className="text-[13px] font-semibold text-[#111111] hover:underline">
              {w.name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#111111]">{w.name}</span>
          )}
          <p className="text-[10px] text-[#7D898C]">
            {w.handle ? `${w.handle} · ` : ''}
            <Ago at={item.at} />
          </p>
        </div>
        <span className="pill bg-emerald-50 text-emerald-600 !text-[9px] font-semibold">{CHANNEL[item.channel] ?? 'Gift'}</span>
      </div>

      {item.message && <p className="text-[14px] text-[#111111] leading-[1.5] mb-3 whitespace-pre-wrap break-words">{item.message}</p>}

      <div className="bg-emerald-50/60 rounded-xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">{item.drop.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-emerald-700 counter">
            {usdText(item.amountUsd)}
            <span className="text-emerald-600/70 font-medium text-[12px]">
              {' '}
              · {units >= 1 ? `${plural(Math.floor(units + 1e-9), item.drop.unitName)}${helpedText(people, item.drop.people)}` : `${Math.round(units * 100)}% of a ${item.drop.unitName}`}
            </span>
          </p>
          <p className="text-[11px] text-emerald-600 truncate">
            into <DropLine drop={item.drop} />
            {chain && <> · from {chain}</>}
          </p>
        </div>
        {item.signature && (
          <a href={explorerTx(item.signature)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-700 font-semibold hover:underline flex-shrink-0">
            Verify ↗
          </a>
        )}
      </div>

      <div className="flex items-center justify-end mt-3">
        <button onClick={() => openGive({ dropId: item.drop.id, amountUsd: item.amountUsd })} className="btn-secondary h-8 px-3 !text-[12px] !rounded-lg">
          Match {usdText(item.amountUsd)}
        </button>
      </div>
    </article>
  )
}

function UpdateCard({ item }: { item: Extract<HomeItem, { type: 'update' }> }) {
  const photos = item.media.filter((m) => m.kind === 'photo').slice(0, 4)
  const video = item.media.find((m) => m.kind === 'video')
  const proof = item.kind === 'proof'
  return (
    <article className="card overflow-hidden">
      {video ? (
        <video src={video.url} controls playsInline preload="metadata" className="w-full max-h-[420px] bg-black" />
      ) : photos.length > 0 ? (
        <div className={`grid gap-0.5 ${photos.length === 1 ? 'grid-cols-1 h-[280px] sm:h-[340px]' : 'grid-cols-2 h-[240px] sm:h-[300px]'}`}>
          {photos.map((m, i) => (
            <div key={m.url} className={`relative overflow-hidden bg-[#E8EDEE] ${photos.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
              <Img src={m.url} alt={m.note || item.title} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`pill !text-[9px] font-semibold ${proof ? 'bg-[#111111] text-white' : 'bg-[#E8EDEE] text-[#3A4548]'}`}>{proof ? 'Proof' : 'Update'}</span>
          <span className="text-[10px] text-[#7D898C] truncate">
            {item.drop.emoji} Drop #{item.drop.id + 1} · <Ago at={item.at} />
          </span>
        </div>
        <p className="text-[15px] font-bold tracking-tight">{item.title}</p>
        {item.body && <p className="text-[13px] text-[#3A4548] mt-1 leading-relaxed whitespace-pre-wrap break-words">{item.body}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11.5px]">
          {item.proofTx && (
            <a href={explorerTx(item.proofTx)} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline">
              Proof on Solana ↗
            </a>
          )}
          {item.xPostUrl && (
            <a href={item.xPostUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#111111] hover:underline">
              Watch on X ↗
            </a>
          )}
          <Link href={dropHref(item.drop.id)} className="text-[#4F5B5E] hover:text-[#111111]">
            Open the drop →
          </Link>
        </div>
      </div>
    </article>
  )
}

function UnlockedCard({ item }: { item: Extract<HomeItem, { type: 'unlocked' }> }) {
  return (
    <article className="rounded-[20px] bg-[#111] text-white p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-emerald-400 text-[12px]">✓</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">Delivered · <Ago at={item.at} /></span>
      </div>
      <p className="text-[17px] font-bold tracking-tight">
        {item.drop.emoji} Drop #{item.drop.id + 1} unlocked {usdText(item.amountUsd)}
      </p>
      <p className="text-[13px] text-white/60 mt-1">
        {item.drop.title} for {item.drop.place}. The pot paid the supplier only after the filmed proof passed review.
      </p>
      <div className="flex items-center gap-4 mt-4 text-[12px]">
        <Link href={dropHref(item.drop.id)} className="font-semibold text-emerald-400 hover:text-emerald-300">
          Watch the proof →
        </Link>
        <a href={explorerTx(item.signature)} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
          Transaction ↗
        </a>
      </div>
    </article>
  )
}

function MissedCard({ item }: { item: Extract<HomeItem, { type: 'missed' }> }) {
  return (
    <article className="card p-4 border border-amber-200/70 bg-amber-50/40">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-1.5">
        {item.cancelled ? 'Called off' : 'Missed its date'} · <Ago at={item.at} />
      </p>
      <p className="text-[15px] font-bold tracking-tight">
        {item.drop.emoji} Drop #{item.drop.id + 1}: every backer gets their money back
      </p>
      <p className="text-[13px] text-[#3A4548] mt-1">
        {item.drop.title} {item.cancelled ? 'was called off' : 'was not proven in time'}, so the program opened refunds{item.potUsd > 0 ? ` for the ${usdText(item.potUsd, 2)} still in the pot` : ''}. Each refund can only go back to the wallet that gave.
      </p>
      <Link href={dropHref(item.drop.id)} className="inline-block mt-3 text-[12px] font-semibold text-amber-800 hover:underline">
        Open the drop →
      </Link>
    </article>
  )
}

function FeesCard({ item }: { item: Extract<HomeItem, { type: 'fees' }> }) {
  return (
    <article className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#E8EDEE] flex items-center justify-center text-lg flex-shrink-0">⇄</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold">
          {usdText(item.totalUsd, 2)} in fees, split by the program
        </p>
        <p className="text-[12px] text-[#4F5B5E] mt-0.5">
          <span className="font-semibold text-emerald-600">{usdText(item.toDropsUsd, 2)} to drops</span> · {usdText(item.toOpsUsd, 2)} to Umanity · <Ago at={item.at} />
        </p>
        <div className="flex items-center gap-4 mt-2 text-[11.5px]">
          <a href={explorerTx(item.signature)} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline">
            Transaction ↗
          </a>
          <Link href="/money" className="text-[#4F5B5E] hover:text-[#111111]">
            Where fees go →
          </Link>
        </div>
      </div>
    </article>
  )
}

/** Trading fees, moved by the program from the drops fund into a drop's pot. */
function FundedCard({ item }: { item: Extract<HomeItem, { type: 'funded' }> }) {
  return (
    <article className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">{item.drop.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold">
          Trading fees put <span className="text-emerald-700">{usdText(item.amountUsd, 2)}</span> into Drop #{item.drop.id + 1}
        </p>
        <p className="text-[12px] text-[#4F5B5E] mt-0.5">
          {item.drop.title} · <Ago at={item.at} />
        </p>
        <div className="flex items-center gap-4 mt-2 text-[11.5px]">
          <a href={explorerTx(item.signature)} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline">
            Transaction ↗
          </a>
          <Link href={dropHref(item.drop.id)} className="text-[#4F5B5E] hover:text-[#111111]">
            See the drop →
          </Link>
        </div>
      </div>
    </article>
  )
}

/** The team's own test gifts, folded into one line: shown on Money, never counted as community. */
function TeamGiftsCard({ gifts, usd }: { gifts: number; usd: number }) {
  return (
    <article className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#E8EDEE] flex items-center justify-center font-mono text-[10px] font-bold uppercase flex-shrink-0">Test</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold">The team tested every way to give</p>
        <p className="text-[12px] text-[#4F5B5E] mt-0.5">
          {gifts} {gifts === 1 ? 'gift' : 'gifts'}, {usdText(usd, usd % 1 ? 2 : 0)} in all, from our own wallets. They never count as community.
        </p>
        <Link href="/money" className="inline-block text-[11.5px] font-semibold text-emerald-600 hover:underline mt-2">
          Where they went →
        </Link>
      </div>
    </article>
  )
}

/** A gift into the drops fund, which backs every drop and only pays into their pots. */
function FundGiftCard({ item }: { item: Extract<HomeItem, { type: 'fundGift' }> }) {
  const { openGive } = useUmanity()
  const w = whoName(item.who)
  const head = <Avatar username={w.seed} url={w.avatar} size={40} />
  return (
    <article className="card p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        {w.href ? <Link href={w.href}>{head}</Link> : head}
        <div className="flex-1 min-w-0">
          {w.href ? (
            <Link href={w.href} className="text-[13px] font-semibold text-[#111111] hover:underline">
              {w.name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#111111]">{w.name}</span>
          )}
          <p className="text-[10px] text-[#7D898C]">
            {w.handle ? `${w.handle} · ` : ''}
            <Ago at={item.at} />
          </p>
        </div>
        <span className="pill bg-emerald-50 text-emerald-600 !text-[9px] font-semibold">{item.channel === 'x402' ? 'Agent · x402' : item.channel === 'intents' ? 'Any chain' : 'Fund'}</span>
      </div>

      {item.message && <p className="text-[14px] text-[#111111] leading-[1.5] mb-3 whitespace-pre-wrap break-words">{item.message}</p>}

      <div className="bg-emerald-50/60 rounded-xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0"><StateIcon state="open" size={26} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-emerald-700 counter">
            {usdText(item.amountUsd)}
            <span className="text-emerald-600/70 font-medium text-[12px]"> · into the Umanity fund</span>
          </p>
          <p className="text-[11px] text-emerald-600 truncate">It backs the next drops, and only pays into their pots.</p>
        </div>
        {item.signature && (
          <a href={explorerTx(item.signature)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-700 font-semibold hover:underline flex-shrink-0">
            Verify ↗
          </a>
        )}
      </div>

      <div className="flex items-center justify-end mt-3">
        <button onClick={() => openGive({ fund: true, amountUsd: item.amountUsd })} className="btn-secondary h-8 px-3 !text-[12px] !rounded-lg">
          Match {usdText(item.amountUsd)}
        </button>
      </div>
    </article>
  )
}
