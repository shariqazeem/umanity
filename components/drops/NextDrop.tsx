'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon } from '@/components/shared/ui'
import { amountInUnits, plural, usdText } from '@/lib/umanity/drops'
import { pickNextDrop, useDrops } from './hooks'
import { DropMeter, StatePill, dayText, dropHref } from './DropParts'

/**
 * The top of Home: the drop the Give button fills right now, with the
 * original black circle. Renders nothing until a real drop exists.
 */
export function NextDrop() {
  const { data: drops, loading } = useDrops()
  const { openGive, signer } = useUmanity()
  const drop = pickNextDrop(drops)
  const delivered = drops?.filter((d) => d.state === 'unlocked') ?? []

  if (loading && !drops) return <div className="skeleton h-56 mb-4" />
  if (!drop) return null

  const { units } = amountInUnits(drop.goalUsd, drop.unit)
  const daysLeft = Math.max(0, Math.ceil((drop.deadline * 1000 - Date.now()) / 86_400_000))

  return (
    <section className="card relative overflow-hidden mb-4">
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-7">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Next drop · {dayText(drop.deadline)}</p>
            <StatePill drop={drop} />
          </div>
          <Link href={dropHref(drop.id)} className="block mt-2 group">
            <h2 className="text-[26px] md:text-[30px] font-black tracking-[-0.03em] leading-[1.05] group-hover:underline decoration-2 underline-offset-4">
              {drop.emoji} {drop.title}
            </h2>
          </Link>
          <p className="text-[13.5px] text-[#86868b] mt-1.5">
            {plural(Math.round(units), drop.unit.name)} for {drop.place}, {drop.unit.covers} each. {daysLeft > 0 ? `${plural(daysLeft, 'day')} left.` : 'Closes today.'}
          </p>
          <div className="mt-5">
            <DropMeter drop={drop} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[12px] text-[#525252]">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="camera" size={14} className="text-emerald-600" /> Pays on filmed proof
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="refresh" size={14} className="text-emerald-600" /> Refunded if it misses {dayText(drop.deadline)}
            </span>
            {delivered.length > 0 && (
              <Link href={dropHref(delivered[0].id)} className="font-semibold text-[#1d1d1f] hover:underline">
                Watch the last drop →
              </Link>
            )}
          </div>
        </div>
        <div className="flex justify-center">
          <button onClick={() => openGive({ dropId: drop.id })} className="btn-primary w-44 h-44 md:w-48 md:h-48 !rounded-full flex flex-col items-center justify-center gap-1 hover:!shadow-2xl hover:!shadow-black/20">
            <span className="text-2xl mb-1">♡</span>
            <span className="font-semibold text-[15px]">{signer ? 'Give' : 'Sign in & give'}</span>
            <span className="text-xs text-white/50">{usdText(drop.unit.usd)} = 1 {drop.unit.name}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
