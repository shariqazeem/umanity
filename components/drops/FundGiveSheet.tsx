'use client'

import { useEffect, useState } from 'react'
import { Transaction } from '@solana/web3.js'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { usdText } from '@/lib/umanity/drops'
import { useMoney, useUsdcBalance } from './hooks'

type Phase = { kind: 'pick' } | { kind: 'signing' } | { kind: 'done'; signature: string; amount: number; pending: boolean } | { kind: 'error'; message: string }

const PRESETS = [1, 5, 10, 25]

/** Gives USDC from the signed-in wallet into the drops fund. Umanity pays the network fee. */
export function FundGiveSheet() {
  const { give, closeGive } = useUmanity()
  const open = !!give?.fund && give.dropId == null
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (open) setEpoch((e) => e + 1)
  }, [open])
  return (
    <Sheet open={open} onClose={closeGive} width="md" hideClose>
      {open && <GiveToFund key={epoch} presetUsd={give!.amountUsd} onClose={closeGive} />}
    </Sheet>
  )
}

function GiveToFund({ presetUsd, onClose }: { presetUsd?: number; onClose: () => void }) {
  const { signer, ensureSigner, ensureUnlocked, toast } = useUmanity()
  const { data: money, reload } = useMoney(30_000)
  const { usd: balance, refresh } = useUsdcBalance(signer?.publicKey ?? null)
  const [amount, setAmount] = useState<number>(presetUsd && PRESETS.includes(presetUsd) ? presetUsd : 5)
  const [custom, setCustom] = useState(presetUsd && !PRESETS.includes(presetUsd) ? String(presetUsd) : '')
  const [anonymous, setAnonymous] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })

  const value = custom ? Number(custom) : amount
  const valid = Number.isFinite(value) && value >= 1 && value <= 25_000
  const short = balance != null && signer ? balance < value : false

  const submit = async () => {
    const s = ensureSigner()
    if (!s || !valid) return
    // Unlock first, inside the tap: the prepared transaction must not wait on a passcode.
    if (!(await ensureUnlocked(`Unlock to give ${usdText(value, value % 1 ? 2 : 0)} to the Umanity fund`))) return
    setPhase({ kind: 'signing' })
    try {
      const prep = await apiSend<{ ref?: string; tx?: string; error?: string }>('/api/fund/give', {
        action: 'prepare',
        from: s.publicKey.toBase58(),
        amountMicro: String(Math.round(value * 1e6)),
        anonymous,
      })
      if (!prep.tx || !prep.ref) throw new Error(prep.error || 'Could not prepare the gift')
      const signed = await s.signTransaction(Transaction.from(Buffer.from(prep.tx, 'base64')))
      const sent = await apiSend<{ signature?: string; pending?: boolean; error?: string }>('/api/fund/give', {
        action: 'submit',
        ref: prep.ref,
        tx: signed.serialize({ requireAllSignatures: false }).toString('base64'),
      })
      if (!sent.signature) throw new Error(sent.error || 'The gift did not go through')
      setPhase({ kind: 'done', signature: sent.signature, amount: value, pending: !!sent.pending })
      refresh()
      reload()
    } catch (e) {
      const message = (e as Error).message || 'Something went wrong'
      if (/reject|cancel/i.test(message)) return setPhase({ kind: 'pick' })
      setPhase({ kind: 'error', message })
    }
  }

  if (phase.kind === 'done') {
    const share = () => {
      const text = `I just put ${usdText(phase.amount)} into the Umanity fund on @umanity_xyz. It can only pay into drops, and a drop pays out only once its delivery is filmed.\n\n${window.location.origin}`
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
    return (
      <div className="bg-[#111] text-white p-8 text-center rounded-[inherit]">
        <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center mx-auto mb-4 text-emerald-400 text-2xl">✓</div>
        <p className="text-[20px] font-bold">{phase.pending ? `${usdText(phase.amount)} is on its way to the fund` : `${usdText(phase.amount)} is in the fund`}</p>
        <p className="text-white/60 text-[13.5px] mt-1.5 max-w-xs mx-auto">It fills the next drops first, and it only pays out once a delivery is filmed.</p>
        <div className="flex items-center gap-1.5 mt-6 max-w-xs mx-auto text-left" aria-label="In the fund, step 1 of 3">
          {['In the fund', 'In a drop', 'Delivered'].map((label, i) => (
            <div key={label} className="flex-1 min-w-0">
              <div className={`h-1 rounded-full ${i === 0 ? 'bg-emerald-400' : 'bg-white/15'}`} />
              <p className={`text-[11px] mt-1.5 ${i === 0 ? 'text-white font-semibold' : 'text-white/40'}`}>{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-7 text-[12.5px]">
          <button onClick={share} className="font-semibold text-emerald-400 hover:text-emerald-300">
            Share on X
          </button>
          <a href={explorerTx(phase.signature)} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white">
            View transaction ↗
          </a>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[14px] bg-emerald-50 flex items-center justify-center text-[20px] text-emerald-700 flex-shrink-0">♡</div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868b]">
            The Umanity fund{money ? ` · ${usdText(money.fund.balance, 2)} in it now` : ''}
          </p>
          <p className="text-[16px] font-bold tracking-tight">Back the next drops</p>
        </div>
        <button onClick={onClose} className="btn-ghost h-8 w-8 !p-0 !rounded-full" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-5">
        {PRESETS.map((usd) => {
          const active = !custom && amount === usd
          return (
            <button
              key={usd}
              onClick={() => {
                setCustom('')
                setAmount(usd)
              }}
              className={`hit rounded-2xl py-3 text-[17px] font-bold counter transition-all border ${active ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]' : 'bg-white border-black/[0.06] hover:border-black/[0.15]'}`}
            >
              {usdText(usd)}
            </button>
          )
        })}
      </div>
      <div className="mt-2">
        <input inputMode="decimal" placeholder="Another amount, in $" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} className="input w-full" />
      </div>

      <ul className="mt-4 space-y-1.5 text-[12.5px] text-[#525252]">
        <li className="flex gap-2">
          <span className="text-emerald-600">✓</span> The fund only pays into drop pots, and a pot pays only after its delivery is filmed.
        </li>
        <li className="flex gap-2">
          <span className="text-emerald-600">✓</span> If a drop misses its date, its money comes back to the fund, not to anyone&apos;s wallet.
        </li>
        <li className="flex gap-2">
          <span className="text-[#aeaeb2]">·</span> A gift to the fund can&apos;t be refunded to you.
        </li>
      </ul>

      {!valid && <p className="text-[12.5px] text-[#525252] mt-3">{value > 25_000 ? 'The biggest single gift is $25,000' : 'The smallest gift is $1'}</p>}

      <label className="flex items-center gap-2 mt-3 text-[12.5px] text-[#525252] cursor-pointer select-none">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="accent-black" />
        Leave my name out of the credits
      </label>

      {phase.kind === 'error' && <p className="mt-3 text-[12.5px] text-red-600">{phase.message}</p>}

      {short ? (
        <div className="mt-5 rounded-2xl bg-[#f5f5f7] p-4">
          <p className="text-[13.5px] font-semibold">You have {usdText(balance ?? 0, 2)} USDC on Solana</p>
          <p className="text-[12.5px] text-[#86868b] mt-1">Send USDC on Solana to your wallet, then come back. Your address:</p>
          <button onClick={() => navigator.clipboard.writeText(signer!.publicKey.toBase58()).then(() => toast('Address copied', 'ok'))} className="mt-2 w-full text-left font-mono text-[11.5px] bg-white rounded-xl px-3 py-2.5 border border-black/[0.06] hover:border-black/[0.15] break-all">
            {signer!.publicKey.toBase58()}
          </button>
          <button onClick={refresh} className="btn-secondary w-full mt-2 py-2.5 !text-[13px]">
            I&apos;ve added USDC
          </button>
        </div>
      ) : (
        <button onClick={submit} disabled={!valid || phase.kind === 'signing'} className="btn-primary w-full py-3.5 mt-5 !text-[15px]">
          {phase.kind === 'signing' ? 'Confirm in your wallet…' : signer ? `Give ${valid ? usdText(value, value % 1 ? 2 : 0) : ''}` : 'Sign in to give'}
        </button>
      )}
      <p className="text-[11px] text-[#aeaeb2] text-center mt-3">Umanity pays the network fee. Every dollar in the fund is on-chain.</p>
    </div>
  )
}
