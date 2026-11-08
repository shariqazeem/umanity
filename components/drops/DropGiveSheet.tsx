'use client'

import { useEffect, useMemo, useState } from 'react'
import { Transaction } from '@solana/web3.js'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet } from '@/components/shared/ui'
import { apiSend } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { amountInUnits, helpedText, plural, usdText } from '@/lib/umanity/drops'
import { useDrop, useUsdcBalance } from './hooks'
import { dayText, dropHref } from './DropParts'
import { AnyChainGive } from './AnyChainGive'

type Phase = { kind: 'pick' } | { kind: 'signing' } | { kind: 'done'; signature: string; amount: number } | { kind: 'error'; message: string }

/** Gives USDC from the signed-in wallet to one drop. Umanity pays the network fee. */
export function DropGiveSheet() {
  const { give, closeGive } = useUmanity()
  const open = !!give && give.dropId != null
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (open) setEpoch((e) => e + 1)
  }, [open])
  return (
    <Sheet open={open} onClose={closeGive} width="md" hideClose>
      {open && <GiveToDrop key={epoch} dropId={give!.dropId!} presetUsd={give!.amountUsd} onClose={closeGive} />}
    </Sheet>
  )
}

function GiveToDrop({ dropId, presetUsd, onClose }: { dropId: number; presetUsd?: number; onClose: () => void }) {
  const { signer, ensureSigner, toast } = useUmanity()
  const { data: drop, reload } = useDrop(dropId, 30_000)
  const { usd: balance, refresh } = useUsdcBalance(signer?.publicKey ?? null)
  const [amount, setAmount] = useState<number>(presetUsd ?? 0)
  const [custom, setCustom] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const [anyChain, setAnyChain] = useState(false)

  const presets = useMemo(() => {
    if (!drop) return []
    const u = drop.unit.usd
    const part = (usd: number) => {
      const k = Math.round(u / usd)
      return Math.abs(u / usd - k) < 0.01 ? `1/${k} of a ${drop.unit.name}` : `${Math.round((usd / u) * 100)}% of a ${drop.unit.name}`
    }
    return [
      ...[5, 10].filter((small) => small < u).map((small) => ({ usd: small, label: part(small) })),
      { usd: u, label: `1 ${drop.unit.name}` },
      { usd: u * 2, label: `2 ${drop.unit.name}s` },
    ]
  }, [drop])
  useEffect(() => {
    if (!amount && presets.length) setAmount(presets.find((p) => p.usd === drop?.unit.usd)?.usd ?? presets[0].usd)
  }, [presets, amount, drop])

  if (!drop) return <div className="p-6"><div className="skeleton h-64" /></div>

  const room = Math.max(0, drop.capUsd - drop.potUsd)
  const value = custom ? Number(custom) : amount
  const valid = Number.isFinite(value) && value >= 1 && value <= room
  const short = balance != null && signer ? balance < value : false
  const { units, people } = amountInUnits(value || 0, drop.unit)

  const submit = async () => {
    const s = ensureSigner()
    if (!s || !valid) return
    setPhase({ kind: 'signing' })
    try {
      const prep = await apiSend<{ ref?: string; tx?: string; error?: string }>(`/api/drops/${dropId}/give`, {
        action: 'prepare',
        from: s.publicKey.toBase58(),
        amountMicro: String(Math.round(value * 1e6)),
        anonymous,
      })
      if (!prep.tx || !prep.ref) throw new Error(prep.error || 'Could not prepare the gift')
      const signed = await s.signTransaction(Transaction.from(Buffer.from(prep.tx, 'base64')))
      const sent = await apiSend<{ signature?: string; error?: string }>(`/api/drops/${dropId}/give`, {
        action: 'submit',
        ref: prep.ref,
        tx: signed.serialize({ requireAllSignatures: false }).toString('base64'),
      })
      if (!sent.signature) throw new Error(sent.error || 'The gift did not go through')
      setPhase({ kind: 'done', signature: sent.signature, amount: value })
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
      const text = `I just put ${usdText(phase.amount)} into ${drop.title} on @umanity_xyz. It only pays out once the delivery is filmed and checked, and comes back to me if it isn't.\n\n${window.location.origin}${dropHref(drop.id)}`
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
    return (
      <div className="bg-[#111] text-white p-8 text-center rounded-[inherit]">
        <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center mx-auto mb-4 text-emerald-400 text-2xl">✓</div>
        <p className="text-[20px] font-bold">{usdText(phase.amount)} is in the pot</p>
        <p className="text-white/60 text-[13.5px] mt-1.5 max-w-xs mx-auto">
          That&apos;s {plural(Math.floor(units + 1e-9) || 0, drop.unit.name)} for {drop.place}. If it isn&apos;t delivered and proven by {dayText(drop.deadline)}, it comes back to you.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-[12.5px]">
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
        <div className="w-11 h-11 rounded-[14px] bg-[#f5f5f7] flex items-center justify-center text-[22px] flex-shrink-0">{drop.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868b]">Drop #{drop.id + 1} · {dayText(drop.deadline)}</p>
          <p className="text-[16px] font-bold tracking-tight truncate">{drop.title}</p>
        </div>
        <button onClick={onClose} className="btn-ghost h-8 w-8 !p-0 !rounded-full" aria-label="Close">
          ✕
        </button>
      </div>

      {anyChain ? (
        <div className="mt-5">
          <AnyChainGive
            dropId={dropId}
            amountUsd={value}
            onBack={() => setAnyChain(false)}
            onDone={(signature, inPot, returned) => {
              if (returned) toast(`${usdText(returned, 2)} didn't fit in the pot, so it went to your wallet`, 'info')
              setPhase({ kind: 'done', signature, amount: inPot })
              refresh()
              reload()
            }}
          />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-2 mt-5">
        {presets.map((p) => {
          const active = !custom && amount === p.usd
          return (
            <button
              key={p.usd}
              onClick={() => {
                setCustom('')
                setAmount(p.usd)
              }}
              className={`rounded-2xl px-4 py-3 text-left transition-all border ${active ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]' : 'bg-white border-black/[0.06] hover:border-black/[0.15]'}`}
            >
              <span className="block text-[17px] font-bold counter">{usdText(p.usd)}</span>
              <span className={`block text-[11.5px] ${active ? 'text-white/60' : 'text-[#86868b]'}`}>{p.label}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-2">
        <input
          inputMode="decimal"
          placeholder="Another amount, in $"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          className="input w-full"
        />
      </div>

      <p className="text-[12.5px] text-[#525252] mt-3 min-h-[18px]">
        {valid
          ? units >= 1
            ? `= ${plural(Math.floor(units + 1e-9), drop.unit.name)}${helpedText(people, drop.unit.people)}`
            : `${Math.round(units * 100)}% of one ${drop.unit.name} (${drop.unit.covers})`
          : value > room
            ? `This pot has room for ${usdText(room, 2)} more`
            : 'The smallest gift is $1'}
      </p>

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
          <button onClick={() => setAnyChain(true)} disabled={!valid} className="btn-primary w-full mt-2 py-2.5 !text-[13px]">
            Pay from another chain instead
          </button>
        </div>
      ) : (
        <button onClick={submit} disabled={!valid || phase.kind === 'signing'} className="btn-primary w-full py-3.5 mt-5 !text-[15px]">
          {phase.kind === 'signing' ? 'Confirm in your wallet…' : signer ? `Give ${valid ? usdText(value, value % 1 ? 2 : 0) : ''}` : 'Sign in to give'}
        </button>
      )}
      {!short && (
        <button onClick={() => setAnyChain(true)} disabled={!valid} className="block w-full text-center text-[12.5px] font-semibold text-[#1d1d1f] mt-3 hover:underline disabled:opacity-40 disabled:no-underline">
          Or pay from 30+ chains: ETH, BTC, USDC on Base…
        </button>
      )}
      <p className="text-[11px] text-[#aeaeb2] text-center mt-3">Umanity pays the network fee. Comes back to you if the drop isn&apos;t proven by {dayText(drop.deadline)}.</p>
      </>
      )}
    </div>
  )
}
