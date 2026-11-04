'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMoney } from '@/components/drops/hooks'
import { DropCard, dropHref } from '@/components/drops/DropParts'
import { explorerAccount, explorerTx } from '@/lib/solana/constants'
import { short, timeAgo } from '@/lib/client/api'
import { usdText } from '@/lib/umanity/drops'
import type { MoneySummary } from '@/lib/umanity/data'

const money = (n: number) => usdText(n, n > 0 && n < 100 ? 2 : 0)

export default function MoneyPage() {
  const { data, loading, error } = useMoney()

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Money</p>
        <h1 className="text-[28px] md:text-[34px] font-black tracking-[-0.035em] leading-[1.05] mt-1">Every dollar, in and out</h1>
        <p className="text-[14px] text-[#86868b] mt-2 max-w-xl">Read from the Solana program, not typed in. Click any number&apos;s transaction to check it yourself.</p>
      </header>

      {error && !data && <div className="card p-6 text-[13px] text-red-600">The money trail could not be loaded: {error}</div>}
      {loading && !data ? <div className="skeleton h-40" /> : data && <Totals d={data} />}
      {data && <Flow d={data} />}

      {data && data.drops.length > 0 && (
        <section>
          <h3 className="text-[17px] font-bold tracking-tight mb-3">Drops</h3>
          <div className="space-y-2.5">
            {data.drops.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        </section>
      )}

      {data && (
        <section className="card p-5">
          <h3 className="font-bold text-[15px] mb-1">Latest money moves</h3>
          <p className="text-[11.5px] text-[#86868b] mb-2">Gifts, unlocks, refunds and fee splits, newest first.</p>
          {data.recent.length ? (
            <ul className="divide-y divide-black/[0.04]">
              {data.recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className="w-7 text-center text-[15px]">{MOVE[e.kind]?.icon ?? '•'}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {MOVE[e.kind]?.text(e) ?? e.kind}
                    {e.dropId != null && (
                      <Link href={dropHref(e.dropId)} className="text-[#86868b] hover:text-[#1d1d1f]">
                        {' '}
                        · Drop #{e.dropId + 1}
                      </Link>
                    )}
                  </span>
                  <span className="font-bold counter">{e.amountUsd != null ? money(e.amountUsd) : ''}</span>
                  <a href={explorerTx(e.signature)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] w-16 text-right">
                    {e.at ? timeAgo(e.at) : 'tx'} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#86868b]">Nothing has moved yet.</p>
          )}
        </section>
      )}

      {data && (
        <section className="card p-5">
          <h3 className="font-bold text-[15px] mb-1">What Umanity spends</h3>
          <p className="text-[11.5px] text-[#86868b] mb-2">Our half of the fees pays for filming, travel, the team and running the app. Every spend is listed with its receipt.</p>
          {data.spending.length ? (
            <ul className="divide-y divide-black/[0.04]">
              {data.spending.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold">{s.description}</span>
                    <span className="text-[#86868b]"> · {s.category}</span>
                  </span>
                  <span className="font-bold counter">{money(s.amountUsd)}</span>
                  {s.receiptUrl && (
                    <a href={s.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-700 font-semibold hover:underline">
                      receipt ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#86868b]">Nothing spent yet.</p>
          )}
        </section>
      )}

      {data && <Rules d={data} />}
    </div>
  )
}

type Move = MoneySummary['recent'][number]
const MOVE: Record<string, { icon: string; text: (e: Move) => ReactNode }> = {
  gave: { icon: '♡', text: (e) => <>Gift from {e.party ? short(e.party) : 'someone'}</> },
  fundedDrop: { icon: '↘', text: () => 'Trading fees put into a pot' },
  unlocked: { icon: '🔓', text: (e) => <>Unlocked to the delivery wallet {e.party ? short(e.party) : ''}</> },
  refunded: { icon: '↩️', text: (e) => <>Refund to {e.party ? short(e.party) : 'a backer'}</> },
  returnedToFund: { icon: '↻', text: () => 'Returned to the drops fund' },
  feesSplit: { icon: '½', text: () => 'Fees split, half to drops, half to Umanity' },
  meteoraFeesClaimed: { icon: '⇄', text: () => '$UMANITY trading fees claimed' },
}

function Totals({ d }: { d: MoneySummary }) {
  const t = d.totals
  const items: [string, number, string][] = [
    ['Came in', t.cameIn, `${t.gifts.toLocaleString('en-US')} gifts`],
    ['In pots now', t.inPots, 'waiting for proof'],
    ['Unlocked', t.unlocked, 'paid for deliveries'],
    ['Refunded', t.refunded, 'back to backers'],
    ['Umanity spent', t.umanitySpent, 'from its half of fees'],
  ]
  return (
    <section className="card p-5 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-5">
        {items.map(([label, value, sub]) => (
          <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
            <p className="text-[24px] md:text-[26px] font-bold counter leading-tight mt-0.5">{money(value)}</p>
            <p className="text-[10.5px] text-[#aeaeb2]">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Node({ title, value, sub, tone = 'white' }: { title: string; value: string; sub: string; tone?: 'white' | 'dark' | 'green' }) {
  const cls = tone === 'dark' ? 'bg-[#1d1d1f] text-white' : tone === 'green' ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border border-black/[0.06]'
  return (
    <div className={`rounded-2xl px-4 py-3 ${cls}`}>
      <p className={`text-[11px] font-semibold ${tone === 'dark' ? 'text-white/60' : 'text-[#86868b]'}`}>{title}</p>
      <p className="text-[18px] font-bold counter leading-tight">{value}</p>
      <p className={`text-[10.5px] ${tone === 'dark' ? 'text-white/50' : 'text-[#86868b]'}`}>{sub}</p>
    </div>
  )
}

const Arrow = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center text-[#aeaeb2] text-[10.5px] py-1">
    <span>↓</span>
    {label && <span>{label}</span>}
  </div>
)

/** Where money flows: gifts and fees into pots, pots into deliveries or back to backers. */
function Flow({ d }: { d: MoneySummary }) {
  const f = d.fees
  return (
    <section className="card p-5">
      <h3 className="font-bold text-[15px] mb-1">How it flows</h3>
      <p className="text-[11.5px] text-[#86868b] mb-4">Gifts go 100% to their drop. Every fee is split by the program: half to drops, half to Umanity.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-[#f5f5f7] p-3">
          <Node title="Gifts" value={money(d.totals.cameIn)} sub="wallets, other chains, AI agents" />
          <Arrow label="100%" />
          <Node title="Drop pots" value={money(d.totals.inPots)} sub="locked until proof and the check" tone="dark" />
          <Arrow />
          <div className="grid grid-cols-2 gap-2">
            <Node title="Unlocked" value={money(d.totals.unlocked)} sub="paid for goods" tone="green" />
            <Node title="Refunded" value={money(d.totals.refunded)} sub="missed dates" />
          </div>
        </div>
        <div className="rounded-3xl bg-[#f5f5f7] p-3">
          <Node title="Fees" value={money(f.split + f.inboxWaiting)} sub={`${money(f.fromToken)} from $UMANITY trades · ${d.swaps.count} ${d.swaps.count === 1 ? 'swap' : 'swaps'} worth ${money(d.swaps.volumeUsd)}`} />
          <Arrow label="split 50/50 by the program" />
          <div className="grid grid-cols-2 gap-2">
            <Node title="Drops fund" value={money(f.toDrops)} sub={`${money(f.fundIntoPots)} put into pots`} tone="green" />
            <Node title="Umanity" value={money(f.toOps)} sub="filming, team, app" />
          </div>
          {f.inboxWaiting > 0 && <p className="text-[11px] text-[#86868b] mt-2 px-1">{money(f.inboxWaiting)} of fees waiting for the next split.</p>}
        </div>
      </div>
    </section>
  )
}

function Rules({ d }: { d: MoneySummary }) {
  const c = d.config
  const link = (addr: string, label?: string) => (
    <a href={explorerAccount(addr)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
      {label ?? short(addr, 6)} ↗
    </a>
  )
  const rows: [string, ReactNode][] = [
    ['Program', link(d.addresses.program)],
    ['Settings', link(d.addresses.config)],
    ['Fee inbox', link(d.addresses.feeInbox)],
    ['Drops fund', link(d.addresses.dropsFund)],
  ]
  if (c) {
    rows.push(
      ['Unlocks signed by', <span key="r">{link(c.releaseAuthority)} {c.releaseLocked ? '· locked for good' : '· Umanity today, a NEAR contract next'}</span>],
      ['Ops wallet', link(c.ops)],
      ['Most one pot can hold', usdText(c.maxPotUsd)],
      ['Check after proof', `${c.reviewHours} hours`],
    )
  }
  return (
    <section className="card p-5">
      <h3 className="font-bold text-[15px] mb-1">The rules, and where they live</h3>
      <p className="text-[11.5px] text-[#86868b] mb-2">Gifts can leave a pot only to its delivery wallet after proof, or back to the backer. Fee money can only go into pots.</p>
      <dl className="divide-y divide-black/[0.04] text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-[#86868b]">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
