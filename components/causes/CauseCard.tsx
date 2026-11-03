'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { fmtSol, short, timeAgo } from '@/lib/client/api'
import { explorerAccount, SOLANA_CLUSTER } from '@/lib/solana/constants'
import type { CauseListItem } from './data'

export function blinkUrl(poolId: string) {
  const actionUrl = `${window.location.origin}/api/actions/donate/${poolId}`
  return `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}${SOLANA_CLUSTER === 'devnet' ? '&cluster=devnet' : ''}`
}

/** The original pool card: emoji tile, category, escrow vault, raised · donors, Blink + Give. */
export function CauseCard({ c }: { c: CauseListItem }) {
  const { openGive } = useUmanity()
  const [copied, setCopied] = useState(false)
  const next = c.nextMilestone
  const target = next?.thresholdSol ?? c.campaign?.target_amount ?? 0
  const pct = target > 0 ? Math.min(100, (c.raisedSol / target) * 100) : 0

  return (
    <div className="card-interactive p-6 flex flex-col">
      <Link href={`/causes/${c.id}`} className="block">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-2xl">{c.emoji}</div>
          <span className="pill bg-black/[0.04] text-[#525252] !text-[10px]">{c.category}</span>
        </div>
        <h4 className="font-semibold mb-1">{c.name}</h4>
        <p className="text-xs text-[#86868b] mb-2 line-clamp-2">{c.tagline}</p>
      </Link>

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="text-[10px] text-[#86868b]">Escrow vault</span>
        {c.vaultPda ? (
          <a href={explorerAccount(c.vaultPda)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 hover:underline font-mono">
            {short(c.vaultPda)}
          </a>
        ) : (
          <span className="text-[10px] text-[#aeaeb2]">opening…</span>
        )}
        <span className="text-[10px] text-[#d4d4d4]">·</span>
        <span className="text-[10px] text-[#86868b]">Delivered by hand · {c.location?.split(',')[0]}</span>
      </div>

      {target > 0 && (
        <div className="mb-4">
          <div className="progress emerald">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-[#86868b] mt-1.5 truncate">
            <span className="counter font-semibold text-[#1d1d1f]">{fmtSol(c.raisedSol, 2)}</span> / <span className="counter">{fmtSol(target, target >= 10 ? 0 : 2)}</span> SOL to unlock delivery #{(next?.index ?? 0) + 1}
          </p>
        </div>
      )}

      {c.latestUpdate && (
        <Link href={`/causes/${c.id}#proof`} className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[#f5f5f7] hover:bg-black/[0.05] transition-colors min-w-0">
          <span className="text-[12px]">🚚</span>
          <span className="text-[11px] text-[#1d1d1f] truncate flex-1">{c.latestUpdate.title}</span>
          <span className="text-[10px] text-[#aeaeb2] flex-shrink-0">{timeAgo(c.latestUpdate.deliveredAt ?? c.latestUpdate.createdAt)}</span>
        </Link>
      )}

      <div className="flex items-center justify-between mt-auto">
        <div>
          <span className="text-sm font-bold counter">{fmtSol(c.raisedSol, 3)}</span>
          <span className="text-xs text-[#86868b] ml-1">SOL</span>
          <span className="text-xs text-[#d4d4d4] mx-1.5">·</span>
          <span className="text-xs text-[#86868b]">
            {c.donorCount} {c.donorCount === 1 ? 'gift' : 'gifts'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(blinkUrl(c.id)).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
            className="py-2 px-3 text-[10px] font-medium rounded-lg border border-black/[0.06] text-[#86868b] hover:text-[#1d1d1f] hover:border-black/[0.12] transition-all"
            title="Copy a Solana Blink for X"
          >
            {copied ? 'Copied!' : 'Blink'}
          </button>
          <button onClick={() => openGive({ causeId: c.id })} className="btn-primary py-2 px-5 !text-xs">
            Give
          </button>
        </div>
      </div>
    </div>
  )
}

export function CauseCardSkeleton() {
  return (
    <div className="card p-6 space-y-3">
      <div className="flex justify-between">
        <div className="skeleton w-12 h-12 !rounded-2xl" />
        <div className="skeleton w-16 h-5" />
      </div>
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-1 w-full mt-4" />
      <div className="flex justify-between pt-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-28" />
      </div>
    </div>
  )
}
