'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Card, Icon, Img, Pill, TxLink } from '@/components/shared/ui'
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

export function DareCard({ dare: initial }: { dare: DareView }) {
  const { user, openGive, solPrice } = useUmanity()
  const [dare, setDare] = useState(initial)
  const left = useCountdown(dare.secondsLeft)
  const { boost, busy } = useBoost(dare, setDare)
  const open = dare.status === 'open' && left > 0
  const isTarget = !!user && user.username === dare.targetHandle
  const cause = getCause(dare.poolId)

  return (
    <Card as="article" className="p-4">
      <div className="flex items-start gap-3">
        <Link href={`/u/${dare.creator.username}`} className="flex-shrink-0">
          <Avatar username={dare.creator.username || 'u'} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] leading-snug">
            <Link href={`/u/${dare.creator.username}`} className="font-semibold hover:underline underline-offset-2">
              {dare.creator.displayName || `@${dare.creator.username}`}
            </Link>{' '}
            dared{' '}
            <Link href={`/u/${dare.targetHandle}`} className="font-semibold hover:underline underline-offset-2">
              @{dare.targetHandle}
            </Link>
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-[#aeaeb2]">
            <Pill tone={open ? 'dark' : dare.status === 'completed' ? 'green' : 'gray'}>
              <Icon name={open ? 'bolt' : dare.status === 'completed' ? 'check' : 'clock'} size={11} />
              {open ? countdown(left) : dare.status === 'completed' ? 'Delivered' : dare.status === 'expired' ? 'Expired · pot went to the cause' : dare.status}
            </Pill>
            {cause && (
              <Link href={`/causes/${dare.poolId}`} className="inline-flex items-center gap-1.5 hover:text-[#1d1d1f]">
                <span className="w-4 h-4 rounded-full overflow-hidden inline-block bg-black/[0.05]">{cause.image && <Img src={cause.image.replace('w=1600', 'w=64')} alt="" />}</span>
                {dare.poolName}
              </Link>
            )}
          </div>
          <p className="font-display text-[22px] leading-[1.15] mt-2.5">&ldquo;{dare.text}&rdquo;</p>
          <div className="flex items-center gap-4 mt-3">
            <div>
              <p className="num text-[22px] font-bold leading-none">{fmtSol(dare.pot, 3)} SOL</p>
              <p className="text-[11.5px] text-[#6e6e73] mt-1 num">
                {solPrice ? `${fmtUsd(dare.pot * solPrice)} · ` : ''}
                {dare.backerCount} {dare.backerCount === 1 ? 'backer' : 'backers'}
              </p>
            </div>
            <p className="text-[12px] text-[#aeaeb2] leading-snug max-w-[220px]">Whether @{dare.targetHandle} delivers or not, the pot goes to {dare.poolName}.</p>
          </div>
          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            {open && isTarget && (
              <Btn tone="accent" size="md" icon="heart" onClick={() => openGive({ causeId: dare.poolId, amountSol: dare.stake, dareId: dare.id })}>
                Accept · give {fmtSol(dare.stake, 3)} SOL
              </Btn>
            )}
            {open && (
              <Btn tone={isTarget ? 'outline' : 'primary'} size="md" icon="plus" onClick={() => boost()} loading={busy} disabled={!dare.darePda}>
                Boost {fmtSol(BOOST_SOL, 2)} SOL
              </Btn>
            )}
            <button onClick={() => shareDare(dare)} className="inline-flex items-center justify-center w-10 h-10 rounded-full text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f]" aria-label="Share dare">
              <Icon name="share" size={16} />
            </button>
            <span className="ml-auto flex items-center gap-3">
              {dare.resolveTxSignature ? <TxLink sig={dare.resolveTxSignature} label="Settlement" /> : dare.createTxSignature ? <TxLink sig={dare.createTxSignature} label="Stake tx" /> : null}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
