'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend, fmtSol, fmtUsd, short } from '@/lib/client/api'
import { Card, Btn, Pill, Mono, Toggle, TxLink, Skeleton } from '@/components/shared/ui'
import { CAUSES, DEFAULT_CAUSE_ID } from '@/lib/causes'
import { useDonate, type DonateResult } from './QuickGive'
import { CROSSCHAIN_VAULT, INTENTS_EXPLORER } from '@/lib/intents/config'

type Mode = 'anychain' | 'solana' | 'demo'

interface Chain {
  id: string
  label: string
  short: string
  tokens: { assetId: string; symbol: string; blockchain: string; decimals: number; price?: number }[]
}

interface Quote {
  dry: boolean
  intentId: string | null
  provider: string
  token: { symbol: string; chain: string; decimals: number }
  recipient: string
  quote: { depositAddress?: string; depositMemo?: string; amountInFormatted: string; amountInUsd?: string; amountOutFormatted: string; amountOutUsd?: string; minAmountOut?: string; timeEstimate?: number; deadline?: string; minAmountIn?: string }
  fee: { bps: number; usd: number | null; note: string }
}

export function GiveTab({ initialCause, initialMode }: { initialCause: string | null; initialMode: 'anychain' | 'solana' | null }) {
  const { signer } = useUmanity()
  const [mode, setMode] = useState<Mode>(initialMode ?? (signer ? 'solana' : 'anychain'))
  const [cause, setCause] = useState(initialCause || DEFAULT_CAUSE_ID)
  useEffect(() => {
    if (initialMode) setMode(initialMode)
  }, [initialMode])
  useEffect(() => {
    if (initialCause) setCause(initialCause)
  }, [initialCause])

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-4">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">Give & Bridge</h2>
        <p className="text-[13px] text-[#52525B]">One terminal. Any chain, one tap on Solana, or a discreet TRM-screened route.</p>
      </div>

      <Card className="p-2 mb-4">
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ['anychain', '🌐 Any chain', 'NEAR Intents · 31+ chains'],
              ['solana', '⚡ Solana', '1-tap · discreet route'],
              ['demo', '🧪 Demo wallet', 'judges start here'],
            ] as const
          ).map(([id, label, sub]) => (
            <button key={id} onClick={() => setMode(id)} className={`rounded-xl px-3 py-2.5 text-left transition-all ${mode === id ? 'bg-[#111113] text-white' : 'hover:bg-[#F3F3F1]'}`}>
              <span className="block text-[13px] font-bold">{label}</span>
              <span className={`block text-[10px] ${mode === id ? 'text-white/60' : 'text-[#A1A1AA]'}`}>{sub}</span>
            </button>
          ))}
        </div>
      </Card>

      <CausePicker value={cause} onChange={setCause} />

      {mode === 'anychain' && <AnyChainTerminal cause={cause} />}
      {mode === 'solana' && <SolanaTerminal cause={cause} />}
      {mode === 'demo' && <DemoWalletCard onReady={() => setMode('solana')} />}
    </div>
  )
}

function CausePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
      {CAUSES.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${value === c.id ? 'bg-white border-[#111113] shadow-sm' : 'bg-white border-[#ECECED] text-[#52525B] hover:border-[#A1A1AA]'}`}>
          <span>{c.emoji}</span> {c.shortName}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------
// Any chain (NEAR Intents / Aurora Intents) — mainnet
// ------------------------------------------------------------------
function AnyChainTerminal({ cause }: { cause: string }) {
  const { address, toast } = useUmanity()
  const [chains, setChains] = useState<Chain[] | null>(null)
  const [meta, setMeta] = useState<{ chainCount: number; tokenCount: number; provider: string; feeBps: number } | null>(null)
  const [chainId, setChainId] = useState('base')
  const [assetId, setAssetId] = useState('')
  const [amount, setAmount] = useState('10')
  const [refundTo, setRefundTo] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [live, setLive] = useState<{ intentId: string; status: string; settlementSignature?: string | null; explorerUrl?: string | null } | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiGet<{ success: boolean; chains?: Chain[]; chainCount?: number; tokenCount?: number; provider?: string; feeBps?: number; error?: string }>('/api/intents/tokens', { timeoutMs: 25_000 })
      .then((d) => {
        if (!d.success) throw new Error(d.error)
        setChains(d.chains ?? [])
        setMeta({ chainCount: d.chainCount ?? 0, tokenCount: d.tokenCount ?? 0, provider: d.provider ?? 'oneclick', feeBps: d.feeBps ?? 50 })
        const base = d.chains?.find((c) => c.id === 'base') ?? d.chains?.[0]
        if (base) {
          setChainId(base.id)
          const usdc = base.tokens.find((t) => t.symbol === 'USDC') ?? base.tokens[0]
          if (usdc) setAssetId(usdc.assetId)
        }
      })
      .catch((e) => {
        setChains([])
        setError(`Could not load the NEAR Intents token list: ${e instanceof Error ? e.message : e}`)
      })
  }, [])

  const chain = chains?.find((c) => c.id === chainId)
  const token = chain?.tokens.find((t) => t.assetId === assetId)

  const getQuote = useCallback(
    async (dry: boolean) => {
      if (!assetId || !(parseFloat(amount) > 0)) return
      setQuoting(true)
      setError('')
      try {
        const r = await apiSend<{ success: boolean; error?: string; needsRefundAddress?: boolean } & Quote>('/api/intents/quote', { originAsset: assetId, amount, poolId: cause, dry, refundTo: refundTo || undefined, userAddress: address || undefined }, 'POST', { timeoutMs: 40_000 })
        if (!r.success) {
          if (r.needsRefundAddress) setQuote(null)
          throw new Error(r.error)
        }
        setQuote(r)
        if (!dry && r.intentId) {
          setLive({ intentId: r.intentId, status: 'pending_deposit' })
          toast('Deposit address created. Send the funds from your wallet or exchange.', 'ok')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Quote failed')
      } finally {
        setQuoting(false)
      }
    },
    [assetId, amount, cause, refundTo, address, toast]
  )

  // auto dry-quote on input change (debounced)
  useEffect(() => {
    if (!assetId) return
    const t = setTimeout(() => getQuote(true), 600)
    return () => clearTimeout(t)
  }, [assetId, amount, cause, getQuote])

  // poll live intent
  useEffect(() => {
    if (!live?.intentId) return
    const poll = async () => {
      const r = await apiGet<{ intent?: { status: string; settlementSignature?: string | null; explorerUrl?: string | null } }>(`/api/intents/status?id=${live.intentId}`)
      if (r.intent) setLive((l) => (l ? { ...l, status: r.intent!.status, settlementSignature: r.intent!.settlementSignature, explorerUrl: r.intent!.explorerUrl } : l))
      if (r.intent && ['success', 'refunded', 'failed'].includes(r.intent.status) && pollRef.current) clearInterval(pollRef.current)
    }
    poll()
    pollRef.current = setInterval(poll, 8000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [live?.intentId])

  const causeMeta = CAUSES.find((c) => c.id === cause)
  const steps = ['Quoting solver', 'Awaiting deposit', 'Swapping to SOL', 'Settled on Solana']
  const stepIdx = !live ? 0 : live.status === 'pending_deposit' ? 1 : live.status === 'processing' ? 2 : live.status === 'success' ? 3 : -1

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[14px] font-bold">Fund {causeMeta?.emoji} {causeMeta?.shortName} from any chain</p>
          <p className="text-[11px] text-[#52525B]">Powered by NEAR Intents{meta?.provider === 'aurora' ? ' via Aurora Intents' : ''}. Mainnet settlement; no bridging, no wrapped tokens.</p>
        </div>
        <Pill tone="indigo">{meta ? `${meta.chainCount} chains · ${meta.tokenCount} assets` : 'loading chains…'}</Pill>
      </div>

      {chains === null ? (
        <Skeleton className="h-40" />
      ) : chains.length === 0 ? (
        <p className="text-[12px] text-red-600">{error || 'Intents are unavailable right now.'}</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-[1fr_1fr_120px] gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">From chain</label>
              <select
                value={chainId}
                onChange={(e) => {
                  setChainId(e.target.value)
                  const c = chains.find((x) => x.id === e.target.value)
                  const t = c?.tokens.find((t) => t.symbol === 'USDC') ?? c?.tokens[0]
                  if (t) setAssetId(t.assetId)
                }}
                className="input !py-2.5"
              >
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Asset</label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input !py-2.5">
                {chain?.tokens.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Amount</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input !py-2.5" />
            </div>
          </div>

          {/* Quote */}
          <div className="mt-4 rounded-2xl bg-[#F8F8F7] border border-[#ECECED] p-4">
            {quoting && !quote ? (
              <Skeleton className="h-12" />
            ) : quote ? (
              <div className="grid sm:grid-cols-3 gap-3 text-[12px]">
                <div>
                  <p className="text-[#A1A1AA]">You send</p>
                  <Mono className="font-bold text-[14px]">
                    {quote.quote.amountInFormatted} {quote.token.symbol}
                  </Mono>
                  {quote.quote.amountInUsd && <p className="text-[#52525B]">≈ {fmtUsd(Number(quote.quote.amountInUsd))}</p>}
                </div>
                <div>
                  <p className="text-[#A1A1AA]">Cause receives (SOL, mainnet)</p>
                  <Mono className="font-bold text-[14px] text-emerald-700">{quote.quote.amountOutFormatted} SOL</Mono>
                  {quote.quote.amountOutUsd && <p className="text-[#52525B]">≈ {fmtUsd(Number(quote.quote.amountOutUsd))} · ~{quote.quote.timeEstimate ?? 120}s</p>}
                </div>
                <div>
                  <p className="text-[#A1A1AA]">Integrator fee</p>
                  <Mono className="font-bold text-[14px]">{quote.fee.bps} bps</Mono>
                  <p className="text-[#52525B]">{quote.fee.usd != null ? `≈ ${fmtUsd(quote.fee.usd)} · ` : ''}Umanity treasury</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[#52525B]">{error || 'Enter an amount to see a live solver quote.'}</p>
            )}
            {quote?.dry && <p className="text-[10px] text-[#A1A1AA] mt-2">Dry quote from the NEAR Intents solver network. Refund path: {quote.token.chain.toUpperCase()} wallet you provide below.</p>}
          </div>

          {/* Go live */}
          {!live && (
            <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Refund address on {chain?.label} (required for a live deposit)</label>
                <input value={refundTo} onChange={(e) => setRefundTo(e.target.value.trim())} placeholder={chain?.id === 'sol' ? 'Your Solana address' : chain?.id === 'btc' ? 'bc1…' : '0x…'} className="input !py-2.5 font-mono !text-[12px]" />
              </div>
              <Btn size="lg" onClick={() => getQuote(false)} loading={quoting} disabled={!quote || !refundTo}>
                Get deposit address
              </Btn>
            </div>
          )}

          {live && quote?.quote.depositAddress && (
            <div className="mt-4 grid sm:grid-cols-[140px_1fr] gap-4 items-start">
              <div className="bg-white border border-[#ECECED] rounded-2xl p-2">
                <QRCodeSVG value={quote.quote.depositAddress} size={124} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#52525B]">Send exactly {quote.quote.amountInFormatted} {quote.token.symbol} on {chain?.label} to</p>
                <Mono className="block text-[12px] break-all mt-1 p-2 rounded-lg bg-[#F3F3F1]">{quote.quote.depositAddress}</Mono>
                {quote.quote.depositMemo && <p className="text-[11px] mt-1">Memo: <Mono>{quote.quote.depositMemo}</Mono></p>}
                <div className="flex gap-2 mt-2">
                  <Btn size="sm" tone="secondary" onClick={() => navigator.clipboard.writeText(quote.quote.depositAddress!).then(() => toast('Copied', 'ok'))}>
                    Copy
                  </Btn>
                  <a href={`${INTENTS_EXPLORER}/?search=${quote.quote.depositAddress}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-indigo-700 hover:underline self-center">
                    NEAR Intents explorer ↗
                  </a>
                </div>
                <p className="text-[10px] text-[#A1A1AA] mt-2">Valid until {quote.quote.deadline ? new Date(quote.quote.deadline).toLocaleTimeString() : 'the quote expires'}. Under-deposits are refunded to your refund address.</p>
              </div>
            </div>
          )}

          {/* Status pill */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {steps.map((s, i) => (
              <span key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${stepIdx === i ? 'bg-[#111113] text-white' : stepIdx > i ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F3F3F1] text-[#A1A1AA]'}`}>
                {stepIdx > i ? '✓' : stepIdx === i ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> : i + 1} {s}
              </span>
            ))}
            {live?.status === 'refunded' && <Pill tone="amber">Refunded</Pill>}
            {live?.status === 'failed' && <Pill tone="coral">Failed</Pill>}
            {live?.settlementSignature && (
              <a href={live.explorerUrl || `https://solscan.io/tx/${live.settlementSignature}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-emerald-700 hover:underline">
                settlement tx ↗
              </a>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F3F3F1] text-[10px] text-[#A1A1AA] leading-relaxed">
            Destination: Umanity cross-chain cause vault <Mono>{short(CROSSCHAIN_VAULT)}</Mono> on Solana mainnet, credited to {causeMeta?.name}. NEAR Intents has no testnet, so this flow is real money; the escrow program itself runs on devnet during the hackathon. Execute-on-arrival into the Anchor vault (Intents Connect) is wired behind the mainnet program deployment.
          </div>
        </>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------
// Solana: one-tap, custom, discreet route
// ------------------------------------------------------------------
function SolanaTerminal({ cause }: { cause: string }) {
  const { signer, solPrice, toast, balance } = useUmanity()
  const { donate, busy } = useDonate()
  const [amount, setAmount] = useState('0.05')
  const [discreet, setDiscreet] = useState(false)
  const [hops, setHops] = useState(3)
  const [est, setEst] = useState<{ configured: boolean; preview: { percentFeeLamports: number; integratorShareLamports: number; estimatedArrivalSeconds: number } } | null>(null)
  const [result, setResult] = useState<DonateResult | null>(null)
  const causeMeta = CAUSES.find((c) => c.id === cause)
  const sol = parseFloat(amount || '0')

  useEffect(() => {
    if (!discreet || !(sol > 0)) return
    apiSend<{ success: boolean; configured?: boolean; preview?: { percentFeeLamports: number; integratorShareLamports: number; estimatedArrivalSeconds: number } }>('/api/multihopper/route', { action: 'estimate', amount: sol, hops }).then((r) => r.preview && setEst({ configured: !!r.configured, preview: r.preview })).catch(() => {})
  }, [discreet, sol, hops])

  const go = async () => {
    if (discreet) {
      if (!signer) return toast('Connect a wallet first', 'info')
      const r = await apiSend<{ success: boolean; error?: string; id?: string }>('/api/multihopper/route', { action: 'create', amount: sol, hops, poolId: cause, source: signer.publicKey.toBase58() })
      if (!r.success) return toast(r.error || 'Discreet route unavailable', 'err')
      return toast('Route created. Signing flow continues in the MultiHopper step (devnet).', 'ok')
    }
    const r = await donate(cause, sol)
    if (r) setResult(r)
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[14px] font-bold">Give SOL to {causeMeta?.emoji} {causeMeta?.shortName}</p>
          <p className="text-[11px] text-[#52525B]">Anchor `donate` into the vault PDA. Record on-chain, certificate, points, streak.</p>
        </div>
        {balance != null && <Mono className="text-[11px] text-[#52525B]">balance {fmtSol(balance, 3)} SOL</Mono>}
      </div>

      <div className="grid sm:grid-cols-[180px_1fr] gap-4">
        <button onClick={() => donate(cause, 0.01).then((r) => r && setResult(r))} disabled={busy} className="rounded-[24px] bg-[#111113] text-white p-5 text-left hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">One tap</p>
          <p className="text-[26px] font-bold tracking-tight mt-1">0.01 SOL</p>
          <p className="text-[11px] text-white/60 mt-1">{solPrice ? fmtUsd(0.01 * solPrice) : '—'} · +10 pts</p>
        </button>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#52525B] mb-1">Custom amount (SOL)</label>
          <input type="number" min="0.001" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input mb-2" />
          <div className="flex gap-1.5">
            {['0.05', '0.1', '0.5', '1'].map((a) => (
              <button key={a} onClick={() => setAmount(a)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold ${amount === a ? 'bg-[#111113] text-white' : 'bg-[#F3F3F1]'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#ECECED] p-4">
        <div className="flex items-center justify-between">
          <Toggle
            on={discreet}
            onChange={setDiscreet}
            label={
              <span className="flex items-center gap-2">
                🛡️ Discreet route <Pill tone="shield">TRM-screened · MultiHopper</Pill>
              </span>
            }
          />
          {discreet && (
            <div className="flex gap-1">
              {[3, 5, 7].map((h) => (
                <button key={h} onClick={() => setHops(h)} className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${hops === h ? 'bg-[#0F172A] text-[#38BDF8]' : 'bg-[#F3F3F1]'}`}>
                  {h} hops
                </button>
              ))}
            </div>
          )}
        </div>
        {discreet && (
          <div className="mt-3">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#52525B] overflow-x-auto">
              <span className="px-2 py-1 rounded-lg bg-[#F3F3F1]">Your wallet</span>
              {Array.from({ length: hops }).map((_, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-[#A1A1AA]">→</span>
                  <span className="px-2 py-1 rounded-lg bg-[#0F172A] text-[#38BDF8]">hop {i + 1}{i === 1 ? ' · TRM screen' : ' · timed'}</span>
                </span>
              ))}
              <span className="text-[#A1A1AA]">→</span>
              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">{causeMeta?.shortName} vault PDA</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
              <div className="rounded-xl bg-[#F8F8F7] p-2.5">
                <p className="text-[#A1A1AA]">Routing fee</p>
                <Mono className="font-semibold">0.50% ({est ? fmtSol(est.preview.percentFeeLamports / 1e9, 4) : '—'} SOL)</Mono>
              </div>
              <div className="rounded-xl bg-[#F8F8F7] p-2.5">
                <p className="text-[#A1A1AA]">Umanity share</p>
                <Mono className="font-semibold">0.25% ({est ? fmtSol(est.preview.integratorShareLamports / 1e9, 4) : '—'} SOL)</Mono>
              </div>
              <div className="rounded-xl bg-[#F8F8F7] p-2.5">
                <p className="text-[#A1A1AA]">Arrival</p>
                <Mono className="font-semibold">~{est ? Math.round(est.preview.estimatedArrivalSeconds / 60) : 10} min</Mono>
              </div>
            </div>
            <p className="text-[10px] text-[#A1A1AA] mt-2">Your donation appears in the feed as “anonymous whale”. Origin, every hop and the vault are screened by TRM Labs. {est && !est.configured ? 'Preview only until a MultiHopper key is configured on this deployment.' : ''}</p>
          </div>
        )}
      </div>

      {result ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-bold text-emerald-800">✓ {result.amount} SOL escrowed · +{result.points} pts · <span className="capitalize">{result.tier}</span> certificate</p>
            <TxLink sig={result.signature} label="View on Solscan" />
          </div>
          <Btn size="sm" tone="secondary" onClick={() => setResult(null)}>
            Give again
          </Btn>
        </div>
      ) : (
        <Btn size="lg" className="w-full mt-4" onClick={go} loading={busy} disabled={!(sol > 0)}>
          {discreet ? `Route ${amount} SOL discreetly` : `Escrow ${amount || '0'} SOL${solPrice ? ` (${fmtUsd(sol * solPrice)})` : ''}`}
        </Btn>
      )}
      {!signer && <p className="text-[11px] text-[#52525B] mt-2 text-center">No wallet? Tapping any button starts an instant devnet demo wallet.</p>}
    </Card>
  )
}

// ------------------------------------------------------------------
// Demo wallet
// ------------------------------------------------------------------
function DemoWalletCard({ onReady }: { onReady: () => void }) {
  const { demo, startDemo, stopDemo, balance, refreshBalance, toast } = useUmanity()
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    const r = await startDemo()
    setBusy(false)
    if (r.error) toast(r.error, 'err')
    else {
      toast(r.funded ? 'Funded with 0.25 devnet SOL' : 'Demo wallet ready', 'ok')
      onReady()
    }
  }
  const addr = useMemo(() => demo?.publicKey.toBase58() ?? '', [demo])
  return (
    <Card className="p-6">
      <p className="text-[14px] font-bold">🧪 Instant demo wallet</p>
      <p className="text-[12px] text-[#52525B] mt-1">A keypair generated in your browser and funded with devnet SOL by the Umanity treasury. Real signatures, real devnet transactions, zero installs. Mainnet never uses it.</p>
      {demo ? (
        <div className="mt-4 rounded-2xl bg-[#F8F8F7] border border-[#ECECED] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#52525B]">Address</p>
          <Mono className="block text-[12px] break-all">{addr}</Mono>
          <div className="flex items-center justify-between mt-3">
            <Mono className="text-[14px] font-bold">{balance != null ? `${fmtSol(balance, 3)} SOL` : '…'}</Mono>
            <div className="flex gap-2">
              <Btn size="sm" tone="secondary" onClick={refreshBalance}>
                Refresh
              </Btn>
              <Btn size="sm" tone="secondary" onClick={start} loading={busy}>
                Top up
              </Btn>
              <Btn size="sm" tone="ghost" onClick={stopDemo}>
                Forget
              </Btn>
            </div>
          </div>
          <Btn className="w-full mt-4" onClick={onReady}>
            Go give →
          </Btn>
        </div>
      ) : (
        <Btn size="lg" tone="emerald" className="w-full mt-4" onClick={start} loading={busy}>
          Create & fund demo wallet
        </Btn>
      )}
      <p className="text-[10px] text-[#A1A1AA] mt-3">Prefer your own wallet? Connect Phantom/Solflare set to devnet and use faucet.solana.com.</p>
    </Card>
  )
}
