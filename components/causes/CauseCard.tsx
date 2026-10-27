'use client'

import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Btn, Icon, Img, Pill, Progress } from '@/components/shared/ui'
import { fmtSol, timeAgo } from '@/lib/client/api'
import type { CauseListItem } from './data'

export function CauseCard({ c }: { c: CauseListItem }) {
  const { openGive } = useUmanity()
  const target = c.nextMilestone?.thresholdSol ?? c.campaign?.target_amount ?? 0
  const raised = c.raisedSol
  const href = `/causes/${c.id}`
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={href} className="block relative h-[210px] overflow-hidden group bg-black/[0.04]">
        {c.image && <Img src={c.image} alt={c.imageAlt} className="group-hover:scale-[1.03] transition-transform duration-700" />}
        <span className="absolute top-3 left-3">
          <Pill tone="white">{c.category}</Pill>
        </span>
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <Link href={href} className="block">
          <h3 className="text-[19px] font-bold tracking-[-0.02em] leading-tight">{c.name}</h3>
        </Link>
        <p className="text-[13.5px] text-[#6e6e73] mt-1.5 leading-relaxed">{c.tagline}</p>
        {c.impact && <p className="text-[13px] text-[#047857] font-semibold mt-3">{c.impact}</p>}

        {target > 0 && (
          <div className="mt-4">
            <Progress value={raised} max={target} />
            <p className="text-[12px] text-[#6e6e73] mt-1.5 num">
              {fmtSol(raised, 2)} of {fmtSol(target, target >= 10 ? 0 : 2)} SOL toward the next delivery
            </p>
          </div>
        )}

        <p className="text-[12px] text-[#6e6e73] mt-3 num">
          {c.supporterCount} {c.supporterCount === 1 ? 'person' : 'people'} · {fmtSol(c.heldSol, 2)} SOL held in escrow
        </p>
        {c.latestUpdate && (
          <p className="text-[12px] text-[#1d1d1f] mt-1.5 flex items-center gap-1.5 min-w-0">
            <Icon name="truck" size={13} className="text-[#047857]" />
            <span className="truncate">{c.latestUpdate.title}</span>
            <span className="text-[#aeaeb2] flex-shrink-0">· {timeAgo(c.latestUpdate.deliveredAt ?? c.latestUpdate.createdAt)}</span>
          </p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-5">
          <Btn tone="accent" icon="heart" onClick={() => openGive({ causeId: c.id })}>
            Give
          </Btn>
          <Link href={href} className="btn btn-ghost h-10 px-3.5 text-[13.5px] ml-auto">
            See the cause <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
    </article>
  )
}

export function CauseCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-[210px] !rounded-none" />
      <div className="p-5 space-y-3">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-2 w-full mt-4" />
        <div className="skeleton h-10 w-24 mt-5" />
      </div>
    </div>
  )
}
