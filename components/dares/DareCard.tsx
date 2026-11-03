'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Icon, TxLink } from '@/components/shared/ui'
import { apiSend, countdown, fmtSol, fmtUsd } from '@/lib/client/api'
import { useCountdown } from '@/lib/client/hooks'
import { boostDareOnChain } from '@/lib/client/solana'
import { getCause } from '@/lib/causes'
import type { DareView } from '@/lib/data/dares'

export const BOOST_SOL = 0.05

export function dareShareUrl(dareId: string) {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/dares/${dareId}`
}

export function shareDare(dare: DareView) {
  const text = `@${dare.creator.username} dared @${dare.targetHandle} on @umanity_xyz: "${dare.text}" — ${fmtSol(dare.pot, 3)} SOL on the line for ${dare.poolName}. Boost the pot:`
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${text}\n\n${dareShareUrl(dare.id)}`)}`, '_blank', 'noopener')
}

export function useBoost(dare: DareView, onBoosted?: (d: DareView) => void) {
  const { ensureSigner, toast, refreshBalance } = useUmanity()
  const { connection } = useConnection()
  const [busy, setBusy] = useState(false)
  const boost = async (sol = BOOST_SOL) => {
    const s = ensureSigner()
    if (!s || !dare.darePda) return
    setBusy(true)
    try {
      const sig = await boostDareOnChain(connection, s, dare.darePda, sol)
      const r = await apiSend<{ success: boolean; error?: string; dare?: DareView }>(`/api/dares/${dare.id}/boost`, { backer: s.publicKey.toBase58(), signature: sig })
      if (!r.success) throw new Error(r.error || 'Boost failed')
      toast(`Pot boosted by ${fmtSol(sol, 3)} SOL.`, 'ok')
      refreshBalance()
      if (r.dare) onBoosted?.(r.dare)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Boost failed'
      toast(/insufficient|0x1\b/i.test(msg) ? 'Not enough SOL in this wallet.' : msg.includes('User rejected') ? 'Cancelled in your wallet.' : msg, 'err')
    } finally {
      setBusy(false)
    }
  }
  return { boost, busy }
}

export function DareCard({ dare: initial, compact }: { dare: DareView; compact?: boolean }) {
  const { user, openGive, solPrice } = useUmanity()
  const [dare, setDare] = useState(initial)
  const left = useCountdown(dare.secondsLeft)
  const { boost, busy } = useBoost(dare, setDare)
  const open = dare.status === 'open' && left > 0
  const isTarget = !!user && user.username === dare.targetHandle
  const cause = getCause(dare.poolId)

  return (
    <article className={`dare-card p-4 ${compact ? 'w-[300px] flex-shrink-0' : ''}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <Link href={`/u/${dare.creator.username}`}>
          <Avatar username={dare.creator.username || 'u'} size={compact ? 32 : 40} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-snug truncate">
            <Link href={`/u/${dare.creator.username}`} className="font-semibold hover:underline">@{dare.creator.username}</Link>
            <span className="text-[#86868b]"> dared </span>
            <Link href={`/u/${dare.targetHandle}`} className="font-semibold hover:underline">@{dare.targetHandle}</Link>
          </p>
          <p className="text-[10px] text-[#aeaeb2] counter">{open ? `${countdown(left)} left` : dare.status === 'completed' ? 'Dare completed' : 'Expired · pot went to the cause'}</p>
        </div>
        <span className="pill bg-amber-50 text-amber-600 !text-[9px] font-semibold">⚡ Dare</span>
      </div>

      <p className={`text-[#1d1d1f] leading-relaxed mb-3 ${compact ? 'text-[13px] line-clamp-2 min-h-[40px]' : 'text-[14px]'}`}>&ldquo;{dare.text}&rdquo;</p>

      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/40 p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">{cause?.emoji || '⚡'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{dare.poolName}</p>
            <p className="text-[10px] text-amber-700 counter">
              {fmtSol(dare.pot, 3)} SOL pot{solPrice ? ` · ${fmtUsd(dare.pot * solPrice)}` : ''} · {dare.backerCount} {dare.backerCount === 1 ? 'backer' : 'backers'}
            </p>
          </div>
          {open && (
            <span className="text-[18px] font-black counter text-amber-600 tabular-nums">{countdown(left).split(' ')[0]}</span>
          )}
        </div>
        {open && (
          <div className="flex gap-2 mt-3">
            {isTarget ? (
              <button onClick={() => openGive({ causeId: dare.poolId, amountSol: dare.stake, dareId: dare.id })} className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold py-2.5 rounded-lg text-[13px] transition-all duration-200">
                Accept · give {fmtSol(dare.stake, 3)} SOL
              </button>
            ) : (
              <button onClick={() => boost()} disabled={busy || !dare.darePda} className="flex-1 bg-white/80 hover:bg-white text-[#1d1d1f] font-semibold py-2.5 rounded-lg text-[12px] transition-all duration-200 border border-amber-200/60 disabled:opacity-50">
                {busy ? 'Boosting…' : `⚡ Boost pot +${fmtSol(BOOST_SOL, 2)} SOL`}
              </button>
            )}
            <button onClick={() => shareDare(dare)} className="px-3 bg-white/80 hover:bg-white rounded-lg border border-amber-200/60 text-[#86868b] hover:text-[#1d1d1f] transition-colors" aria-label="Share dare on X">
              <Icon name="share" size={14} />
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between mt-2.5 text-[11px] text-[#86868b]">
          <span>Delivered or not, the pot goes to {dare.poolName}.</span>
          {dare.resolveTxSignature ? <TxLink sig={dare.resolveTxSignature} label="Settlement" /> : dare.createTxSignature ? <TxLink sig={dare.createTxSignature} label="Stake tx" /> : null}
        </div>
      )}
      {compact && (
        <Link href={`/dares/${dare.id}`} className="block text-[11px] font-semibold text-amber-700 mt-2.5 hover:underline">
          Open dare →
        </Link>
      )}
    </article>
  )
}
