'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'
import { useTokenSummary } from '@/components/trade/hooks'
import { usdText } from '@/lib/umanity/drops'
import { FUND_GOAL, FUND_GOAL_DATE, goalDateText } from '@/lib/umanity/goal'
import { useMoney } from './hooks'

const CIRCLES_ON = !!process.env.NEXT_PUBLIC_CIRCLES_COLLECTION

/**
 * The top of Home and Give while no drop is open: the drops fund, live, with
 * the original black circle. Gifts and trading fees wait here and fill the next drops first.
 */
export function FundCard() {
  const { data: money } = useMoney(30_000)
  const { openGive, signer } = useUmanity()
  const token = useTokenSummary()
  const fund = money?.fund
  const givers = money?.outside.fundGivers ?? 0

  return (
    <section className="card relative overflow-hidden mb-4">
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-7">
        <div className="flex-1 min-w-0">
          {FUND_GOAL ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">The first filmed drop · on Solana</p>
              <h2 className="text-[26px] md:text-[30px] font-black tracking-[-0.03em] leading-[1.05] mt-2 [text-wrap:balance]">{FUND_GOAL} people open the first filmed drop.</h2>
              <p className="text-[13.5px] text-[#86868b] mt-1.5 max-w-lg [text-wrap:balance]">
                Give $1 or more to the fund. At {FUND_GOAL} givers{FUND_GOAL_DATE ? `, or on ${goalDateText(FUND_GOAL_DATE)}` : ''}, the first drop opens, filled from the fund, and its film credits every giver.
              </p>
              <div className="mt-5">
                {money ? (
                  <p className="text-[34px] font-black tracking-[-0.03em] counter leading-none">
                    {givers.toLocaleString('en-US')} <span className="text-[#c7c7cc]">of {FUND_GOAL}</span>
                  </p>
                ) : (
                  <div className="skeleton h-[34px] w-28" />
                )}
                <p className="text-[10.5px] text-[#86868b] uppercase tracking-[0.12em] font-medium mt-1.5">Givers so far, team not counted</p>
                <div className="h-1.5 rounded-full bg-black/[0.05] mt-3 max-w-xs overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, (givers / FUND_GOAL) * 100)}%` }} />
                </div>
                {fund && <p className="text-[12px] text-[#525252] mt-2">{usdText(fund.balance, 2)} in the fund now</p>}
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">The Umanity fund · on Solana</p>
              <h2 className="text-[26px] md:text-[30px] font-black tracking-[-0.03em] leading-[1.05] mt-2 [text-wrap:balance]">Back every drop that comes next.</h2>
              <p className="text-[13.5px] text-[#86868b] mt-1.5 max-w-lg [text-wrap:balance]">No drop is open right now. Gifts and trading fees wait here, on-chain, and fill the next drops first.</p>
              <div className="mt-5">
                {fund ? <p className="text-[34px] font-black tracking-[-0.03em] counter leading-none">{usdText(fund.balance, 2)}</p> : <div className="skeleton h-[34px] w-28" />}
                <p className="text-[10.5px] text-[#86868b] uppercase tracking-[0.12em] font-medium mt-1.5">In the fund now</p>
                {fund && (fund.fromFees > 0 || fund.gifts > 0) && (
                  <p className="text-[12px] text-[#525252] mt-2">
                    So far:{' '}
                    {[fund.fromFees > 0 && `${usdText(fund.fromFees, 2)} from trading fees`, fund.gifts > 0 && `${usdText(fund.gifts, 2)} from gifts`].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-[12px] text-[#525252]">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="lock" size={14} className="text-emerald-600" /> Only pays into drop pots
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="camera" size={14} className="text-emerald-600" /> Drops pay out on filmed proof
            </span>
            {CIRCLES_ON && (
              <Link href="/circles" className="font-semibold text-[#1d1d1f] hover:underline">
                The first hundred each hold a Circle →
              </Link>
            )}
            {token && !CIRCLES_ON && (
              <Link href="/trade" className="font-semibold text-[#1d1d1f] hover:underline">
                Every $UMANITY trade adds 0.4% →
              </Link>
            )}
          </div>
        </div>
        <div className="flex justify-center">
          <button onClick={() => openGive({ fund: true })} className="btn-primary w-44 h-44 md:w-48 md:h-48 !rounded-full flex flex-col items-center justify-center gap-1 hover:!shadow-2xl hover:!shadow-black/20">
            <span className="text-2xl mb-1">♡</span>
            <span className="font-semibold text-[15px]">{signer ? 'Give' : 'Sign in & give'}</span>
            <span className="text-xs text-white/50">{FUND_GOAL ? 'From $1 · no refunds' : 'From $1, no SOL needed'}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
