'use client'

import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Field, Img, Avatar } from '@/components/shared/ui'
import { apiGet, apiSend, fmtSol, fmtUsd } from '@/lib/client/api'
import { createDareOnChain } from '@/lib/client/solana'
import { CAUSES, DEFAULT_CAUSE_ID, getCause } from '@/lib/causes'
import type { DareView } from '@/lib/data/dares'

const STAKES = [0.05, 0.1, 0.5]
const TIMERS: [number, string][] = [
  [24, '24 hours'],
  [48, '48 hours'],
  [168, '7 days'],
]

export function DareComposer({ open, onClose, onCreated, initialCause, initialAmount, initialTarget }: { open: boolean; onClose: () => void; onCreated: (d: DareView) => void; initialCause?: string | null; initialAmount?: number | null; initialTarget?: string | null }) {
  const { signer, solPrice, balance, toast, refreshBalance, ensureSigner } = useUmanity()
  const { connection } = useConnection()
  const [target, setTarget] = useState('')
  const [targetAddress, setTargetAddress] = useState<string | null>(null)
  const [results, setResults] = useState<{ username: string; address: string; displayName: string }[]>([])
  const [text, setText] = useState('')
  const [poolId, setPoolId] = useState(DEFAULT_CAUSE_ID)
  const [stake, setStake] = useState(0.05)
  const [hours, setHours] = useState(48)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const cause = initialCause && getCause(initialCause) ? initialCause : DEFAULT_CAUSE_ID
    setPoolId(cause)
    const amt = initialAmount && initialAmount > 0 ? Math.round(initialAmount * 1000) / 1000 : 0.05
    setStake(amt)
    setText(initialAmount && initialAmount > 0 ? `Match my ${fmtSol(amt, 3)} SOL to ${getCause(cause)?.name ?? 'this cause'}` : '')
    setTarget(initialTarget ? initialTarget.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32) : '')
    setTargetAddress(null)
    setResults([])
  }, [open, initialCause, initialAmount, initialTarget])

  const search = async (q: string) => {
    setTarget(q)
    setTargetAddress(null)
    if (q.length < 2) return setResults([])
    try {
      const r = await apiGet<{ profiles?: { username: string; address: string; displayName: string }[] }>(`/api/social/search?q=${encodeURIComponent(q)}`)
      setResults((r.profiles ?? []).slice(0, 5))
    } catch {
      setResults([])
    }
  }

  const create = async () => {
    const s = ensureSigner()
    if (!s) return
    if (balance != null && balance < stake + 0.003) return toast('Not enough SOL in this wallet for that stake.', 'err')
    setBusy(true)
    try {
      const { signature, darePda } = await createDareOnChain(connection, s, { poolId, targetHandle: target, text, stakeSol: stake, hours, targetWallet: targetAddress })
      const r = await apiSend<{ success: boolean; error?: string; dare?: DareView }>('/api/dares', { creator: s.publicKey.toBase58(), targetHandle: target, poolId, text, hours, signature, darePda })
      if (!r.success || !r.dare) throw new Error(r.error || 'Could not record the dare')
      toast(`Dare sent. ${fmtSol(stake, 3)} SOL locked until @${target} answers.`, 'ok')
      refreshBalance()
      onCreated(r.dare)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create the dare'
      toast(/insufficient|0x1\b/i.test(msg) ? 'Not enough SOL in this wallet.' : msg.includes('User rejected') ? 'Cancelled in your wallet.' : msg, 'err')
    } finally {
      setBusy(false)
    }
  }

  const cause = getCause(poolId)
  const ready = target.length >= 2 && text.trim().length > 0 && stake > 0 && !!signer

  return (
    <Sheet open={open} onClose={onClose} width="md" hideClose>
      <div className="pt-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[30px] leading-[1.05]">Dare a friend.</h3>
            <p className="text-[13.5px] text-[#6e6e73] mt-1">You lock a stake. If they give, the pot goes to the cause. If they don&apos;t, it still does.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-[#6e6e73] hover:bg-black/[0.05]">
            ×
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Who">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2]">@</span>
              <input value={target} onChange={(e) => search(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))} placeholder="their username" className="input !pl-9" autoFocus />
            </div>
            {results.length > 0 && !targetAddress && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {results.map((r) => (
                  <button
                    key={r.address}
                    onClick={() => {
                      setTarget(r.username)
                      setTargetAddress(r.address)
                      setResults([])
                    }}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 h-8 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[12.5px] font-semibold"
                  >
                    <Avatar username={r.username} size={22} /> @{r.username}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="The dare">
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder="Match my gift to Orphan care this week" className="input" />
          </Field>

          <div>
            <span className="text-[12.5px] font-semibold block mb-1.5">Cause</span>
            <div className="-mx-6 px-6 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 w-max">
                {CAUSES.map((c) => {
                  const on = c.id === poolId
                  return (
                    <button key={c.id} onClick={() => setPoolId(c.id)} className={`flex items-center gap-2 pl-1 pr-3 h-10 rounded-full border transition-all ${on ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-black/[0.08] bg-white hover:border-black/30'}`}>
                      <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-black/[0.05]">
                        <Img src={c.image.replace('w=1600', 'w=96')} alt="" />
                      </span>
                      <span className="text-[13px] font-semibold whitespace-nowrap">{c.shortName}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[12.5px] font-semibold block mb-1.5">Your stake</span>
              <div className="grid grid-cols-3 gap-1.5">
                {STAKES.map((s) => (
                  <button key={s} onClick={() => setStake(s)} className={`h-10 rounded-xl text-[13px] font-semibold num transition-all ${stake === s ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] hover:bg-black/[0.07]'}`}>
                    {s}
                  </button>
                ))}
              </div>
              {!STAKES.includes(stake) && <p className="text-[11.5px] text-[#6e6e73] mt-1.5 num">Custom: {fmtSol(stake, 3)} SOL</p>}
            </div>
            <div>
              <span className="text-[12.5px] font-semibold block mb-1.5">They have</span>
              <div className="grid grid-cols-3 gap-1.5">
                {TIMERS.map(([h, label]) => (
                  <button key={h} onClick={() => setHours(h)} className={`h-10 rounded-xl text-[12.5px] font-semibold transition-all ${hours === h ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] hover:bg-black/[0.07]'}`}>
                    {label.replace(' hours', 'h').replace(' days', 'd')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#fafafa] border border-black/[0.06] p-3.5 text-[13px] text-[#6e6e73] leading-relaxed">
            You lock <span className="font-semibold text-[#1d1d1f] num">{fmtSol(stake, 3)} SOL</span>
            {solPrice ? <span className="num"> ({fmtUsd(stake * solPrice)})</span> : null} for {cause?.name}. Friends can boost the pot. When it settles, 1.5% keeps Umanity running and the rest reaches the cause.
          </div>

          <Btn tone="accent" size="xl" full onClick={create} loading={busy} disabled={!ready}>
            {signer ? `Lock ${fmtSol(stake, 3)} SOL and send the dare` : 'Sign in to send a dare'}
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
