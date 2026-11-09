'use client'

import Link from 'next/link'
import { useMoney } from '@/components/drops/hooks'
import { PriceChart, priceText } from '@/components/trade/PriceChart'
import { useMarket, useTokenSummary } from '@/components/trade/hooks'
import { usdText } from '@/lib/umanity/drops'

/**
 * $UMANITY in one row, for screens without the right rail: its price and today's
 * line, what its fees have sent to drops, and a way to Trade. Hidden until the token exists.
 */
export function TokenStrip() {
  const token = useTokenSummary()
  const market = useMarket(token ? '1d' : null)
  const { data: money } = useMoney(60_000)
  if (!token) return null
  const change = market?.changePct ?? null
  const up = (change ?? 0) >= 0
  return (
    <Link href="/trade" className="xl:hidden card-interactive p-4 flex items-center gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">$UMANITY</p>
        <p className="text-[19px] font-black tracking-[-0.03em] counter leading-tight mt-0.5">
          {priceText(token.priceUsd)}
          {change != null && <span className={`ml-2 text-[11.5px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{up ? '▲' : '▼'} {Math.abs(change) < 0.05 ? '0.0' : Math.abs(change).toFixed(1)}%</span>}
        </p>
        <p className="text-[11.5px] text-[#86868b] mt-0.5">
          Its fees sent <span className="font-semibold text-emerald-600 counter">{usdText((money?.fees.fromToken ?? 0) / 2, 2)}</span> to drops
        </p>
      </div>
      <div className="flex-1 min-w-[72px] pointer-events-none">{market ? <PriceChart points={market.points} height={40} /> : <div className="skeleton h-[40px]" />}</div>
      <span className="text-[12.5px] font-semibold text-[#1d1d1f] whitespace-nowrap">Trade →</span>
    </Link>
  )
}
