'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'
import { useTokenSummary } from '@/components/trade/hooks'
import { usdText } from '@/lib/umanity/drops'
import { useMoney } from './hooks'

/**
 * The top of Home and Give while no drop is open: the drops fund, live, with
 * the original black circle. Gifts and trading fees wait here and fill the next drops first.
 */
export function FundCard() {
  const { data: money } = useMoney(30_000)
  const { openGive, signer } = useUmanity()
  const token = useTokenSummary()
  const fund = money?.fund

  return (
    <section className="card relative overflow-hidden mb-4">
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-7">
        <div className="flex-1 min-w-0">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-[12px] text-[#525252]">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="lock" size={14} className="text-emerald-600" /> Only pays into drop pots
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="camera" size={14} className="text-emerald-600" /> Drops pay out on filmed proof
            </span>
            {token && (
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
            <span className="text-xs text-white/50">From $1, no SOL needed</span>
          </button>
        </div>
      </div>
    </section>
  )
}
