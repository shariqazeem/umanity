'use client'

import { useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Modal, Btn, Mono, TxLink, Pill } from '@/components/shared/ui'
import { apiSend, fmtUsd } from '@/lib/client/api'
import { donateSol } from '@/lib/client/solana'
import type { PoolView } from '@/lib/data/donations'

export interface DonateResult {
  signature: string
  amount: number
  points: number
  tier: string
}

/** Shared donation flow: sign → confirm → verify on server → feed/points. */
export function useDonate() {
  const { signer, toast, refreshUser, refreshBalance, startDemo } = useUmanity()
  const { connection } = useConnection()
  const [busy, setBusy] = useState(false)
  const donate = async (poolId: string, sol: number): Promise<DonateResult | null> => {
    let s = signer
    if (!s) {
      const r = await startDemo()
      if (r.error) {
        toast(r.error, 'err')
        return null
      }
      toast('Demo wallet funded. Sending your donation…', 'info')
      // the provider updates `signer` asynchronously; re-read via a short wait
      await new Promise((r) => setTimeout(r, 1200))
      s = signer
      if (!s) {
        toast('Demo wallet ready. Tap again to donate.', 'info')
        return null
      }
    }
    setBusy(true)
    try {
      const signature = await donateSol(connection, s, poolId, sol)
      const r = await apiSend<{ success: boolean; error?: string; rewardPoints?: number; tier?: string; donation?: { amount: number } }>('/api/donate/sync', { donor: s.publicKey.toBase58(), pool: poolId, signature })
      refreshBalance()
      refreshUser()
      if (!r.success) {
        toast(`On-chain ✓ (${signature.slice(0, 8)}…) but recording failed: ${r.error}`, 'err')
        return { signature, amount: sol, points: 0, tier: 'bronze' }
      }
      return { signature, amount: r.donation?.amount ?? sol, points: r.rewardPoints ?? 0, tier: r.tier ?? 'bronze' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      toast(msg.includes('insufficient') || msg.includes('0x1') ? 'Not enough devnet SOL. Fund the wallet first.' : msg, 'err')
      return null
    } finally {
      setBusy(false)
    }
  }
  return { donate, busy }
}

export function QuickGive({ pool, onClose, onDone }: { pool: PoolView | null; onClose: () => void; onDone: () => void }) {
  const { solPrice } = useUmanity()
  const { donate, busy } = useDonate()
  const [amount, setAmount] = useState('0.05')
  const [result, setResult] = useState<DonateResult | null>(null)
  const close = () => {
    setResult(null)
    onClose()
  }
  const go = async () => {
    if (!pool) return
    const r = await donate(pool.id, parseFloat(amount))
    if (r) {
      setResult(r)
      onDone()
    }
  }
  return (
    <Modal open={!!pool} onClose={close}>
      {pool && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-[#F3F3F1] flex items-center justify-center text-2xl">{pool.emoji}</div>
            <div>
              <h3 className="text-[16px] font-bold">{pool.name}</h3>
              <p className="text-[11px] text-[#52525B]">Into the on-chain escrow vault. Released by vote.</p>
            </div>
          </div>
          {result ? (
            <div className="rounded-2xl bg-emerald-50 p-5 text-center">
              <p className="text-[32px]">✓</p>
              <p className="font-bold text-emerald-800">
                {result.amount} SOL escrowed
              </p>
              <p className="text-[12px] text-emerald-700 mt-1">
                +{result.points} impact points · <span className="capitalize">{result.tier}</span> certificate minted
              </p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <TxLink sig={result.signature} label="View on Solscan" />
                <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(`Just escrowed ${result.amount} SOL for ${pool.name} on @umanity_xyz. Released only when the community verifies delivery.\n\nhttps://solscan.io/tx/${result.signature}?cluster=devnet`)}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-emerald-700 hover:underline">
                  Share on X
                </a>
              </div>
              <Btn className="w-full mt-4" onClick={close}>
                Done
              </Btn>
            </div>
          ) : (
            <>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Amount (SOL)</label>
              <input type="number" min="0.001" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input mb-2" />
              <div className="flex gap-1.5 mb-4">
                {['0.01', '0.05', '0.1', '0.5'].map((a) => (
                  <button key={a} onClick={() => setAmount(a)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold ${amount === a ? 'bg-[#111113] text-white' : 'bg-[#F3F3F1]'}`}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#52525B] mb-4">
                <span>
                  ≈ <Mono>{solPrice ? fmtUsd(parseFloat(amount || '0') * solPrice) : '—'}</Mono> · +<Mono>{Math.floor(parseFloat(amount || '0') * 1000)}</Mono> points
                </span>
                <Pill tone="emerald">0% platform fee</Pill>
              </div>
              <Btn size="lg" className="w-full" onClick={go} loading={busy} disabled={!(parseFloat(amount) > 0)}>
                Escrow {amount || '0'} SOL
              </Btn>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
