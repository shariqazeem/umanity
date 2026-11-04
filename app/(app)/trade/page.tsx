'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { usdText } from '@/lib/umanity/drops'
import { TRADE_TOKENS, tradeToken, type TradeToken } from '@/lib/umanity/tokens'
import type { TokenSummary } from '@/lib/umanity/token'
import { useMoney } from '@/components/drops/hooks'

type Quote = { out: number; feeBps: number; feeUsd: number; priceImpactPct: number; route: string[] } | { error: string }
type Built = { tx: string; inAmount: string; outAmount: string; minOut: string; feeBps: number; feeMicro: number; usdMicro: number | null; sponsored: boolean; error?: string }
type Phase = { kind: 'idle' } | { kind: 'working'; step: string } | { kind: 'done'; signature: string; got: number; to: TradeToken; feeUsd: number; sponsored: boolean } | { kind: 'error'; message: string }

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 2 : n >= 1 ? 4 : 8 })
const NATIVE = 'So11111111111111111111111111111111111111112'

/** The signed-in wallet's balance of one token, in whole units. */
function useBalance(owner: PublicKey | null, token: TradeToken | undefined) {
  const { connection } = useConnection()
  const [bal, setBal] = useState<number | null>(null)
  const refresh = useCallback(async () => {
    if (!owner || !token) return setBal(null)
    try {
      if (token.mint === NATIVE) return setBal((await connection.getBalance(owner)) / 1e9)
      const r = await connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(token.mint) })
      setBal(r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0))
    } catch {
      setBal(null)
    }
  }, [owner, token, connection])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { bal, refresh }
}

export default function TradePage() {
  const { isMainnet, signer, ensureSigner, toast } = useUmanity()
  const [from, setFrom] = useState('USDC')
  const [to, setTo] = useState('SOL')
  const [amount, setAmount] = useState('20')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const fromToken = tradeToken(from)
  const toToken = tradeToken(to)
  const { bal, refresh } = useBalance(signer?.publicKey ?? null, fromToken)

  useEffect(() => {
    const n = Number(amount)
    if (!(n > 0) || from === to) return setQuote(null)
    const t = setTimeout(async () => {
      setQuote(await apiGet<Quote>(`/api/trade/quote?from=${from}&to=${to}&amount=${n}`).catch((e) => ({ error: (e as Error).message })))
    }, 350)
    return () => clearTimeout(t)
  }, [from, to, amount])

  const flip = () => {
    setFrom(to)
    setTo(from)
    setPhase({ kind: 'idle' })
  }

  const n = Number(amount)
  const short = bal != null && n > bal
  const ok = !!quote && 'out' in quote && n > 0 && !short

  const swap = async () => {
    const s = ensureSigner()
    if (!s || !fromToken || !toToken || !ok) return
    setPhase({ kind: 'working', step: 'Finding the best route…' })
    try {
      const raw = BigInt(Math.round(n * 10 ** fromToken.decimals)).toString()
      const built = await apiSend<Built>('/api/trade/build', { from: s.publicKey.toBase58(), inputMint: fromToken.mint, outputMint: toToken.mint, amount: raw, slippageBps: 50 })
      if (!built.tx) throw new Error(built.error || 'Could not build the swap')
      setPhase({ kind: 'working', step: 'Confirm in your wallet…' })
      const signed = await s.signTransaction(VersionedTransaction.deserialize(Buffer.from(built.tx, 'base64')))
      setPhase({ kind: 'working', step: 'Swapping…' })
      const sent = await apiSend<{ signature?: string; error?: string }>('/api/trade/submit', {
        tx: Buffer.from(signed.serialize()).toString('base64'),
        inputMint: fromToken.mint,
        outputMint: toToken.mint,
        inAmount: built.inAmount,
        outAmount: built.outAmount,
        usdMicro: built.usdMicro,
        feeBps: built.feeBps,
        feeMicro: built.feeMicro,
      })
      if (!sent.signature) throw new Error(sent.error || 'The swap did not go through')
      setPhase({ kind: 'done', signature: sent.signature, got: Number(built.outAmount) / 10 ** toToken.decimals, to: toToken, feeUsd: built.feeMicro / 1e6, sponsored: built.sponsored })
      refresh()
    } catch (e) {
      const message = (e as Error).message || 'Something went wrong'
      if (/reject|cancel/i.test(message)) return setPhase({ kind: 'idle' })
      setPhase({ kind: 'error', message })
    }
  }

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Trade</p>
        <h1 className="text-[28px] md:text-[34px] font-black tracking-[-0.035em] leading-[1.05] mt-1">Swaps that feed people</h1>
        <p className="text-[14px] text-[#86868b] mt-2 max-w-xl">
          Best-price routing by Jupiter. Umanity takes 0.5% on trades in or out of USDC, less than Phantom&apos;s 0.85%, and the program sends half of it to drops.
        </p>
      </header>

      <TokenCard onBuy={() => (setFrom('USDC'), setTo('UMANITY'), setPhase({ kind: 'idle' }))} onSell={() => (setFrom('UMANITY'), setTo('USDC'), setPhase({ kind: 'idle' }))} />

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <section className="card p-5 w-full max-w-[520px]">
          {phase.kind === 'done' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 text-emerald-600 text-2xl">✓</div>
              <p className="text-[20px] font-bold counter">
                You got {fmt(phase.got)} {phase.to.symbol}
              </p>
              <p className="text-[13px] text-[#86868b] mt-1.5 max-w-xs mx-auto">
                {phase.feeUsd > 0 ? `Your ${usdText(phase.feeUsd, 2)} fee went to the program's fee inbox. Half of it will fill drops.` : 'No Umanity fee on this pair.'}
                {phase.sponsored ? ' Umanity paid the network fee.' : ''}
              </p>
              <div className="flex items-center justify-center gap-4 mt-5 text-[12.5px]">
                <a href={explorerTx(phase.signature)} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:underline">
                  View transaction ↗
                </a>
                <button onClick={() => setPhase({ kind: 'idle' })} className="text-[#86868b] hover:text-[#1d1d1f]">
                  Swap again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
                  <span>You pay</span>
                  {bal != null && (
                    <button onClick={() => setAmount(String(fromToken?.mint === NATIVE ? Math.max(0, Math.floor((bal - 0.01) * 1e4) / 1e4) : bal))} className="hover:text-[#1d1d1f]">
                      Balance {fmt(bal)} · Max
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <input inputMode="decimal" value={amount} onChange={(e) => (setAmount(e.target.value.replace(/[^0-9.]/g, '')), setPhase({ kind: 'idle' }))} className="flex-1 min-w-0 bg-transparent text-[28px] font-bold counter outline-none" />
                  <TokenSelect value={from} onChange={(v) => (setFrom(v), setPhase({ kind: 'idle' }))} />
                </div>
              </div>
              <div className="flex justify-center -my-3 relative z-10">
                <button onClick={flip} aria-label="Swap direction" className="w-9 h-9 rounded-full bg-white border border-black/[0.08] shadow-sm flex items-center justify-center text-[15px] hover:bg-[#f5f5f7]">
                  ↓
                </button>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div className="text-[11px] font-semibold text-[#86868b]">You get</div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="flex-1 min-w-0 text-[28px] font-bold counter truncate">{quote && 'out' in quote ? fmt(quote.out) : '…'}</p>
                  <TokenSelect value={to} onChange={(v) => (setTo(v), setPhase({ kind: 'idle' }))} />
                </div>
              </div>

              <div className="mt-3 min-h-[52px] text-[12px] text-[#86868b] space-y-1">
                {quote && 'error' in quote && <p className="text-red-600">{quote.error}</p>}
                {quote && 'out' in quote && (
                  <>
                    <p className="flex justify-between gap-3">
                      <span>Route</span>
                      <span className="text-right text-[#525252]">
                        {quote.route.slice(0, 3).join(', ') || 'Jupiter'} · impact {quote.priceImpactPct < 0.01 ? '<0.01' : quote.priceImpactPct.toFixed(2)}%
                      </span>
                    </p>
                    <p className="flex justify-between gap-3">
                      <span>Umanity fee</span>
                      <span className="text-right text-[#525252]">
                        {quote.feeBps ? (
                          <>
                            {usdText(quote.feeUsd, 2)} · <span className="text-emerald-600 font-semibold">{usdText(quote.feeUsd / 2, 2)} to drops</span>
                          </>
                        ) : (
                          'None on this pair'
                        )}
                      </span>
                    </p>
                  </>
                )}
              </div>

              {phase.kind === 'error' && <p className="mt-2 text-[12.5px] text-red-600">{phase.message}</p>}

              {isMainnet ? (
                <button onClick={swap} disabled={!ok || phase.kind === 'working'} className="btn-primary w-full py-3.5 mt-3 !text-[14px]">
                  {phase.kind === 'working' ? phase.step : !signer ? 'Sign in to swap' : short ? `Not enough ${from}` : `Swap ${from} for ${to}`}
                </button>
              ) : (
                <>
                  <button disabled className="btn-primary w-full py-3.5 mt-3 !text-[14px]">
                    Swapping runs on Solana mainnet
                  </button>
                  <p className="text-[11px] text-[#aeaeb2] text-center mt-2">This is the devnet preview. Prices are live mainnet quotes.</p>
                </>
              )}
              {isMainnet && signer && (
                <p className="text-[11px] text-[#aeaeb2] text-center mt-2">
                  No SOL for gas? Umanity pays the network fee for small wallets, a few swaps a day.
                  <button onClick={() => navigator.clipboard.writeText(signer.publicKey.toBase58()).then(() => toast('Address copied', 'ok'))} className="ml-1 underline hover:text-[#86868b]">
                    Copy your address
                  </button>
                </p>
              )}
            </>
          )}
        </section>

        <aside className="card p-5 w-full lg:max-w-[340px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 mb-2">Where your fee goes</p>
          <ol className="space-y-3 text-[13px] text-[#525252]">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span>The fee is paid in USDC into the program&apos;s fee inbox, in the same transaction as your swap.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span>Only the program can move it, and only one way: half to the drops fund, half to Umanity.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              <span>The drops fund can only pay into drop pots, which unlock only after a filmed, checked delivery.</span>
            </li>
          </ol>
          <Link href="/money" className="inline-block mt-4 text-[12.5px] font-semibold text-[#1d1d1f] hover:underline">
            Follow every dollar on Money →
          </Link>
        </aside>
      </div>
    </div>
  )
}

/** $UMANITY, from its Meteora pool. Hidden until the token exists. */
function TokenCard({ onBuy, onSell }: { onBuy: () => void; onSell: () => void }) {
  const [token, setToken] = useState<TokenSummary | null>(null)
  const { data: money } = useMoney(60_000)
  useEffect(() => {
    let alive = true
    const load = () => apiGet<{ token?: TokenSummary | null }>('/api/token').then((d) => alive && setToken(d.token ?? null)).catch(() => {})
    load()
    const t = setInterval(load, 20_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  if (!token) return null
  const toDrops = (money?.fees.fromToken ?? 0) / 2
  return (
    <section className="card relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />
      <div className="relative p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">$UMANITY · Meteora</p>
          <div className="flex items-end gap-3 mt-1.5 flex-wrap">
            <p className="text-[30px] font-black tracking-[-0.03em] leading-none counter">${token.priceUsd < 0.01 ? token.priceUsd.toPrecision(3) : token.priceUsd.toFixed(4)}</p>
            <p className="text-[13px] text-[#86868b] pb-0.5 counter">market cap {usdText(token.marketCapUsd, 0)}</p>
          </div>
          {token.graduated ? (
            <p className="text-[12.5px] text-[#525252] mt-3">Graduated to a Meteora DAMM v2 pool. Its liquidity is locked for good to the program.</p>
          ) : (
            <>
              <div className="progress emerald mt-3">
                <span style={{ width: `${Math.max(1, Math.round(token.progress * 100))}%` }} />
              </div>
              <p className="text-[12px] text-[#86868b] mt-1.5 counter">
                {usdText(token.raisedUsd, 0)} of {usdText(token.graduateAtUsd, 0)} to graduation · then its liquidity is locked for good
              </p>
            </>
          )}
          <p className="text-[12px] text-[#525252] mt-2">
            Trading fees sent to drops so far: <span className="font-semibold text-emerald-600">{usdText(toDrops, 2)}</span>
            {token.feesOwedUsd > 0 && <span className="text-[#86868b]"> · {usdText(token.feesOwedUsd / 2, 2)} more on the way</span>}
          </p>
        </div>
        <div className="flex md:flex-col gap-2 md:w-36">
          <button onClick={onBuy} className="btn-primary flex-1 py-2.5 !text-[13px]">
            Buy
          </button>
          <button onClick={onSell} className="btn-secondary flex-1 py-2.5 !text-[13px]">
            Sell
          </button>
        </div>
      </div>
      <p className="relative px-5 md:px-6 pb-4 text-[10.5px] text-[#aeaeb2]">No team tokens, no presale. Not an investment, and no returns are promised.</p>
    </section>
  )
}

function TokenSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-full bg-white border border-black/[0.08] px-3 text-[14px] font-semibold outline-none cursor-pointer">
      {TRADE_TOKENS.map((t) => (
        <option key={t.symbol} value={t.symbol}>
          {t.symbol}
        </option>
      ))}
    </select>
  )
}
