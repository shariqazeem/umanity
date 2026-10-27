'use client'

/** Supporters, recent gifts and open dares for a cause. */
import Link from 'next/link'
import { Avatar, Empty, Icon, Pill, TxLink } from '@/components/shared/ui'
import { countdown, fmtSol, timeAgo } from '@/lib/client/api'
import { useCountdown } from '@/lib/client/hooks'
import type { GiftView, Supporter } from '@/lib/contracts'
import type { DareView } from '@/lib/data/dares'

const CHAIN_NAMES: Record<string, string> = { eth: 'Ethereum', base: 'Base', arb: 'Arbitrum', btc: 'Bitcoin', sol: 'Solana', near: 'NEAR', ton: 'TON', tron: 'Tron', pol: 'Polygon', bsc: 'BNB Chain', op: 'Optimism', avax: 'Avalanche', gnosis: 'Gnosis', sui: 'Sui', aptos: 'Aptos', xrp: 'XRP Ledger', doge: 'Dogecoin', ltc: 'Litecoin', bch: 'Bitcoin Cash', stellar: 'Stellar', cardano: 'Cardano', starknet: 'Starknet', zec: 'Zcash', monad: 'Monad', aurora: 'Aurora', scroll: 'Scroll' }

function chainLabel(chain: string | null) {
  if (!chain) return null
  return CHAIN_NAMES[chain] ?? chain.toUpperCase()
}

export function Supporters({ supporters, count, friends, onGive }: { supporters: Supporter[]; count: number; friends: string[]; onGive: () => void }) {
  if (!supporters.length && count === 0) {
    return (
      <Empty
        icon="users"
        title="No one has given here yet"
        sub="The first gift opens this vault. It is held in escrow until the delivery is proven."
        action={
          <button onClick={onGive} className="btn btn-accent h-11 px-6 text-[14px]">
            Be the first
          </button>
        }
      />
    )
  }
  return (
    <div>
      {friends.length > 0 && (
        <div className="rounded-2xl bg-[#ecfdf5] text-[#047857] px-4 py-3 text-[13px] font-medium mb-4 flex items-center gap-2">
          <Icon name="users" size={15} />
          <span>
            {friends.length} {friends.length === 1 ? 'person' : 'people'} you follow gave here: {friends.slice(0, 4).map((u) => `@${u}`).join(', ')}
            {friends.length > 4 ? ` and ${friends.length - 4} more` : ''}
          </span>
        </div>
      )}
      <ul className="grid sm:grid-cols-2 gap-2">
        {supporters.slice(0, 12).map((s) => {
          const name = s.anonymous ? 'Anonymous' : s.displayName || `@${s.username}`
          const inner = (
            <>
              <Avatar username={s.anonymous ? 'anonymous' : s.username} url={s.anonymous ? null : s.avatarUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold truncate">{name}</span>
                <span className="block text-[11.5px] text-[#6e6e73] num">
                  {fmtSol(s.amount, 3)} SOL · {s.count} {s.count === 1 ? 'gift' : 'gifts'} · {timeAgo(s.lastAt)}
                </span>
              </span>
            </>
          )
          return (
            <li key={s.address}>
              {s.anonymous ? (
                <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5">{inner}</div>
              ) : (
                <Link href={`/u/${s.username}`} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 hover:border-black/20 transition-colors">
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      {count > supporters.length && <p className="text-[12px] text-[#aeaeb2] mt-3 num">{count} people in total.</p>}
    </div>
  )
}

export function GiftsList({ gifts }: { gifts: GiftView[] }) {
  if (!gifts.length) return null
  return (
    <ul className="card divide-y divide-black/[0.06]">
      {gifts.slice(0, 15).map((g) => {
        const chain = chainLabel(g.sourceChain)
        return (
          <li key={g.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar username={g.anonymous ? 'anonymous' : g.username} url={g.anonymous ? null : g.avatarUrl} size={32} />
            <span className="min-w-0 flex-1 text-[13px]">
              {g.anonymous ? <span className="font-semibold">Someone</span> : (
                <Link href={`/u/${g.username}`} className="font-semibold hover:underline">
                  {g.displayName || `@${g.username}`}
                </Link>
              )}{' '}
              gave <span className="num font-semibold">{fmtSol(g.amount, 3)} SOL</span>
              {chain && g.route === 'intents' && <span className="text-[#6e6e73]"> from {chain}</span>}
              {g.route === 'multihopper' && <span className="text-[#6e6e73]"> privately</span>}
              <span className="text-[#aeaeb2]"> · {timeAgo(g.createdAt)}</span>
            </span>
            <TxLink sig={g.signature} label="tx" className="flex-shrink-0" />
          </li>
        )
      })}
    </ul>
  )
}

export function DaresList({ dares }: { dares: DareView[] }) {
  if (!dares.length) return null
  return (
    <ul className="space-y-2">
      {dares.map((d) => (
        <DareRow key={d.id} d={d} />
      ))}
    </ul>
  )
}

function DareRow({ d }: { d: DareView }) {
  const left = useCountdown(d.secondsLeft)
  return (
    <li>
      <Link href={`/dares/${d.id}`} className="card card-hover flex items-center gap-3 px-4 py-3">
        <span className="w-9 h-9 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center flex-shrink-0">
          <Icon name="bolt" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] leading-snug">
            <span className="font-semibold">@{d.creator.username}</span> dared <span className="font-semibold">@{d.targetHandle}</span>: {d.text}
          </span>
          <span className="block text-[11.5px] text-[#6e6e73] mt-0.5 num">
            {fmtSol(d.pot, 3)} SOL in the pot · {d.backerCount} {d.backerCount === 1 ? 'backer' : 'backers'}
          </span>
        </span>
        <Pill tone={d.status === 'open' ? 'green' : 'gray'}>{d.status === 'open' ? countdown(left) : d.status}</Pill>
      </Link>
    </li>
  )
}
