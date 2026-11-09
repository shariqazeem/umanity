'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend, short, timeAgo } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { usdText } from '@/lib/umanity/drops'
import { TRADE_TOKENS, tradeToken, type TradeToken } from '@/lib/umanity/tokens'
import type { TokenSummary } from '@/lib/umanity/token'
import { useMoney } from '@/components/drops/hooks'
import { PriceChart, priceText, type ChartPoint } from '@/components/trade/PriceChart'
import { useMarket, useTokenSummary, type Timeframe } from '@/components/trade/hooks'
import type { Market } from '@/app/api/token/market/route'

type Quote = { out: number; feeBps: number; feeUsd: number; priceImpactPct: number; route: string[] } | { error: string }
type Built = { tx: string; inAmount: string; outAmount: string; minOut: string; feeBps: number; feeMicro: number; usdMicro: number | null; sponsored: boolean; error?: string }
type Phase = { kind: 'idle' } | { kind: 'working'; step: string } | { kind: 'done'; signature: string; got: number; to: TradeToken; feeUsd: number; sponsored: boolean } | { kind: 'error'; message: string }

/** Amounts that fit their box: 1,318,402.55 → 1.32M. */
const fmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 2 : n >= 1 ? 4 : 8 })
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
  const { isMainnet, signer, ensureSigner, ensureUnlocked, toast } = useUmanity()
  const [from, setFrom] = useState('USDC')
  const [to, setTo] = useState(TRADE_TOKENS.some((t) => t.symbol === 'UMANITY') ? 'UMANITY' : 'SOL')
  const [tf, setTf] = useState<Timeframe>('1d')
  const token = useTokenSummary()
  const market = useMarket(token ? tf : null)
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
    if (!(await ensureUnlocked('Unlock to swap'))) return
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
        <p className="text-[14px] text-[#86868b] mt-2 max-w-xl [text-wrap:balance]">Jupiter&apos;s best route, with 0.5% when USDC is one side. Half of it fills the next drop.</p>
      </header>

      <TokenCard token={token} market={market} tf={tf} onTf={setTf} onBuy={() => (setFrom('USDC'), setTo('UMANITY'), setPhase({ kind: 'idle' }))} onSell={() => (setFrom('UMANITY'), setTo('USDC'), setPhase({ kind: 'idle' }))} />

      <div className={`grid gap-5 items-start ${token ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <section className={`card p-5 w-full ${token ? '' : 'max-w-[560px]'}`}>
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

        {token && <TradesCard trades={market ? market.trades : undefined} />}
      </div>

      <section className="card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 mb-3">Where every fee goes</p>
          <ol className="grid md:grid-cols-3 gap-4 text-[13px] text-[#525252]">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span>Swaps pay 0.5% when USDC is one side, and $UMANITY trades pay its pool&apos;s 1%. Both go to the program, in the same transaction.</span>
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
      </section>
    </div>
  )
}

const FRAMES: [Timeframe, string][] = [
  ['1h', '1H'],
  ['1d', '1D'],
  ['1w', '1W'],
]

/** $UMANITY: its price and line, how far the curve has filled, and what its fees have sent to drops. Hidden until the token exists. */
function TokenCard({ token, market, tf, onTf, onBuy, onSell }: { token: TokenSummary | null; market: Market | null; tf: Timeframe; onTf: (tf: Timeframe) => void; onBuy: () => void; onSell: () => void }) {
  const { data: money } = useMoney(60_000)
  const [hover, setHover] = useState<ChartPoint | null>(null)
  if (!token) return null
  const toDrops = (money?.fees.fromToken ?? 0) / 2
  const change = market?.changePct ?? null
  const up = (change ?? 0) >= 0
  const price = hover?.p ?? token.priceUsd
  return (
    <section className="card overflow-hidden">
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">$UMANITY · Meteora</p>
            <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
              <p className="text-[30px] md:text-[34px] font-black tracking-[-0.03em] leading-none counter">{priceText(price)}</p>
              {change != null && !hover && (
                <span className={`text-[12.5px] font-bold counter ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                  {up ? '▲' : '▼'} {Math.abs(change) < 0.05 ? '0.0' : Math.abs(change).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-[#86868b] mt-1.5 counter">
              Market cap {usdText(token.marketCapUsd, 0)}
              {market?.volume24hUsd != null && ` · 24h volume ${usdText(market.volume24hUsd, 0)}`}
            </p>
          </div>
          <div className="hidden md:flex flex-col gap-2 w-36 flex-shrink-0">
            <button onClick={onBuy} className="btn-primary py-2.5 !text-[13px]">
              Buy
            </button>
            <button onClick={onSell} className="btn-secondary py-2.5 !text-[13px]">
              Sell
            </button>
          </div>
        </div>

        <div className="mt-5">
          {market ? <PriceChart points={market.points} height={160} onHover={setHover} /> : <div className="skeleton h-[160px]" />}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1">
            {FRAMES.map(([id, label]) => (
              <button key={id} onClick={() => onTf(id)} className={`hit h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${tf === id ? 'bg-[#1d1d1f] text-white' : 'text-[#86868b] hover:bg-black/[0.04]'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#aeaeb2]">{market?.source === 'chain' ? 'Price from the chain' : 'Chart by GeckoTerminal'}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-[#f5f5f7] p-3.5">
            {token.graduated ? (
              <p className="text-[12.5px] text-[#525252]">Graduated to a Meteora DAMM v2 pool. Its liquidity is locked for good to the program.</p>
            ) : (
              <>
                <p className="text-[12px] text-[#86868b] counter">
                  {usdText(token.raisedUsd, 0)} of {usdText(token.graduateAtUsd, 0)} to graduation
                </p>
                <div className="progress emerald mt-2">
                  <span style={{ width: `${Math.max(1, Math.round(token.progress * 100))}%` }} />
                </div>
                <p className="text-[11px] text-[#aeaeb2] mt-1.5">Then its liquidity is locked for good.</p>
              </>
            )}
          </div>
          <div className="rounded-2xl bg-emerald-50/70 p-3.5">
            <p className="text-[12px] text-emerald-800/80">Its trading fees sent to drops</p>
            <p className="text-[20px] font-black text-emerald-700 counter mt-0.5">{usdText(toDrops, 2)}</p>
            <p className="text-[11px] text-emerald-800/60 mt-0.5">
              {token.feesOwedUsd > 0 ? `${usdText(token.feesOwedUsd / 2, 2)} more on the way · ` : ''}every trade sends 0.4%
            </p>
          </div>
        </div>

        <div className="md:hidden flex gap-2 mt-4">
          <button onClick={onBuy} className="btn-primary flex-1 py-3 !text-[14px]">
            Buy
          </button>
          <button onClick={onSell} className="btn-secondary flex-1 py-3 !text-[14px]">
            Sell
          </button>
        </div>
      </div>
      <p className="px-5 md:px-6 pb-4 text-[10.5px] text-[#aeaeb2]">No team tokens, no presale. Not an investment, and no returns are promised.</p>
    </section>
  )
}

/** The latest $UMANITY trades, each linked to its transaction. */
function TradesCard({ trades }: { trades: Market['trades'] | undefined }) {
  const fresh = trades?.some((t) => Date.now() / 1000 - t.at < 3600)
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">Latest trades</p>
        {fresh && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#86868b]">
            <span className="pulse-dot" />
            live
          </span>
        )}
      </div>
      {trades === null ? (
        <p className="text-[12.5px] text-[#86868b] mt-3">The trade feed is catching up. Every trade is on Solscan meanwhile.</p>
      ) : !trades ? (
        <div className="space-y-2 mt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      ) : trades.length ? (
        <ul className="mt-2 divide-y divide-black/[0.04]">
          {trades.slice(0, 8).map((t) => (
            <li key={t.tx} className="flex items-center gap-2.5 py-2.5 text-[13px]">
              <span className={`w-11 text-center text-[10.5px] font-bold rounded-full py-0.5 flex-shrink-0 ${t.kind === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{t.kind === 'buy' ? 'Buy' : 'Sell'}</span>
              <span className="font-semibold counter">{usdText(t.usd, t.usd < 10 ? 2 : 0)}</span>
              <span className="text-[#aeaeb2] font-mono text-[11px] truncate">{short(t.wallet)}</span>
              <a href={explorerTx(t.tx)} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11.5px] text-[#86868b] hover:text-[#1d1d1f] whitespace-nowrap">
                {timeAgo(new Date(t.at * 1000).toISOString())} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[#86868b] mt-3">No trades yet. Every trade sends 0.4% of it to drops.</p>
      )}
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
