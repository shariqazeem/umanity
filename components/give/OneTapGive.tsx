'use client'

import { useState } from 'react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { useStats } from '@/lib/client/hooks'
import { fmtSol } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { CAUSES, DEFAULT_CAUSE_ID, getCause } from '@/lib/causes'
import { useDonate } from './useDonate'

const ONE_TAP_SOL = 0.01

/** The signature Umanity card: one big black circle, 0.01 SOL, done. */
export function OneTapGive() {
  const { signer, ensureSigner, isMainnet, requestFaucet, balance, toast } = useUmanity()
  const { donate } = useDonate()
  const stats = useStats(30_000)
  const [causeId, setCauseId] = useState(DEFAULT_CAUSE_ID)
  const [status, setStatus] = useState<'idle' | 'signing' | 'success'>('idle')
  const [result, setResult] = useState<{ signature: string; points: number } | null>(null)
  const cause = getCause(causeId)!

  const give = async () => {
    const s = ensureSigner()
    if (!s) return
    if (balance != null && balance < ONE_TAP_SOL + 0.002) {
      if (!isMainnet) {
        const r = await requestFaucet()
        if (!r.ok) return toast(r.error || 'This wallet needs a little devnet SOL first.', 'err')
      } else {
        return toast('This wallet needs a little SOL first.', 'err')
      }
    }
    setStatus('signing')
    const r = await donate(causeId, ONE_TAP_SOL)
    if (!r) return setStatus('idle')
    setResult({ signature: r.signature, points: r.points })
    setStatus('success')
    setTimeout(() => {
      setStatus('idle')
      setResult(null)
    }, 7000)
  }

  const share = () => {
    const text = `Just gave ${ONE_TAP_SOL} SOL to ${cause.name} on @umanity_xyz with one tap. It waits in escrow on Solana until the delivery is proven.\n\n${window.location.origin}/causes/${cause.id}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <section>
      <div className="card relative overflow-hidden">
        {status === 'success' && result && (
          <div className="absolute inset-0 bg-[#111] flex flex-col items-center justify-center z-10 animate-in px-6 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-lg font-semibold mb-1">Gift confirmed</p>
            <p className="text-white/50 text-sm mb-1">
              {cause.emoji} {cause.name} · +{result.points} reward points
            </p>
            <p className="text-white/35 text-[12px] mb-4">Held in escrow until the delivery is proven.</p>
            <div className="flex items-center gap-4">
              <a href={`/gift/${result.signature}`} className="text-emerald-400 text-xs font-semibold underline hover:text-emerald-300 transition-colors">
                Follow your gift →
              </a>
              <a href={explorerTx(result.signature)} target="_blank" rel="noopener noreferrer" className="text-white/50 text-xs underline hover:text-white/80 transition-colors">
                View on Solscan
              </a>
              <button onClick={share} className="text-white/50 text-xs underline hover:text-white/80 transition-colors font-medium">
                Share on X
              </button>
            </div>
          </div>
        )}

        <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-widest mb-3">One-tap giving</p>
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">0.01 SOL</h3>
            <p className="text-[#86868b] text-sm leading-relaxed mb-4">
              Instant on-chain gift into the {cause.name.toLowerCase()} escrow vault.
              <br />
              Earn 10 reward points every time.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center md:justify-start mb-6">
              {CAUSES.map((c) => (
                <button key={c.id} onClick={() => setCauseId(c.id)} title={c.name} className={`h-8 px-2.5 rounded-full text-[12px] font-medium transition-all ${c.id === causeId ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] text-[#525252] hover:bg-black/[0.07]'}`}>
                  {c.emoji} {c.shortName}
                </button>
              ))}
            </div>
            <div className="flex gap-8 justify-center md:justify-start">
              <div>
                <div className="text-2xl font-bold counter">{stats ? fmtSol(stats.totalDonations, 2) : '—'}</div>
                <div className="text-[11px] text-[#86868b] mt-0.5">SOL given</div>
              </div>
              <div>
                <div className="text-2xl font-bold counter">{stats ? stats.totalGifts : '—'}</div>
                <div className="text-[11px] text-[#86868b] mt-0.5">Gifts</div>
              </div>
              <div>
                <div className="text-2xl font-bold counter">{stats ? fmtSol(stats.totalEscrowed, 2) : '—'}</div>
                <div className="text-[11px] text-[#86868b] mt-0.5">In escrow</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5">
            <button onClick={give} disabled={status === 'signing'} className="btn-primary w-48 h-48 !rounded-full text-base flex flex-col items-center justify-center gap-1 hover:!shadow-2xl hover:!shadow-black/20">
              {status === 'signing' ? (
                <span className="flex flex-col items-center gap-2">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">Signing</span>
                </span>
              ) : (
                <>
                  <span className="text-2xl mb-1">♡</span>
                  <span className="font-semibold">{signer ? 'Give' : 'Sign in & give'}</span>
                  <span className="text-xs text-white/50">0.01 SOL</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-3 text-[11px] text-[#86868b]">
              <span>On-chain</span>
              <span className="w-1 h-1 rounded-full bg-[#d4d4d4]" />
              <span>Escrowed</span>
              <span className="w-1 h-1 rounded-full bg-[#d4d4d4]" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
