'use client'

/**
 * The one give flow, opened from anywhere via useUmanity().openGive().
 *   cause → amount (USD-first, impact shown as what it buys) → pay with a
 *   Solana wallet or from any chain (NEAR Intents) → success.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useUmanity, type GiveRequest } from '@/components/providers/UmanityProvider'
import { Sheet, Btn, Pill, Icon, Toggle, TxLink, Skeleton, Img, Field, CopyButton, Spinner } from '@/components/shared/ui'
import { CAUSES, DEFAULT_CAUSE_ID, describeImpact, getCause } from '@/lib/causes'
import { apiGet, apiSend, fmtSol, fmtUsd } from '@/lib/client/api'
import { useDonate, type DonateResult } from './useDonate'
import { INTENTS_EXPLORER } from '@/lib/intents/config'
import { explorerTx } from '@/lib/solana/constants'

const USD_PRESETS = [5, 10, 25, 50, 100]
const SOL_PRESETS = [0.05, 0.1, 0.25, 0.5, 1]
const MIN_SOL = 0.001

export function GiveSheet() {
  const { give, closeGive } = useUmanity()
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (give) setEpoch((e) => e + 1)
  }, [give])
  return (
    <Sheet open={!!give} onClose={closeGive} width="md" hideClose>
      {give && <GiveFlow key={epoch} req={give} onClose={closeGive} />}
    </Sheet>
  )
}

function GiveFlow({ req, onClose }: { req: GiveRequest; onClose: () => void }) {
  const { signer, solPrice, balance, user, isMainnet, createWallet, connectWallet, requestFaucet, toast, openWalletSheet } = useUmanity()
  const { donate, busy } = useDonate()
  const [causeId, setCauseId] = useState(req.causeId && getCause(req.causeId) ? req.causeId : DEFAULT_CAUSE_ID)
  const [unit, setUnit] = useState<'usd' | 'sol'>(req.amountSol ? 'sol' : 'usd')
  const [custom, setCustom] = useState<string>(req.amountSol ? String(req.amountSol) : req.amountUsd ? String(req.amountUsd) : '')
  const [preset, setPreset] = useState<number | null>(req.amountSol || req.amountUsd ? null : solPrice ? 25 : 0.1)
  const [method, setMethod] = useState<'solana' | 'anychain'>(req.method ?? 'solana')
  const [anonymous, setAnonymous] = useState(false)
  const [privateRoute, setPrivateRoute] = useState(false)
  const [mh, setMh] = useState<{ configured: boolean; feeSol: number; shareSol: number; minutes: number } | null>(null)
  const [result, setResult] = useState<DonateResult | null>(null)
  const [creating, setCreating] = useState(false)
  const cause = getCause(causeId)!

  // Presets follow the price: USD when we know it, SOL otherwise.
  useEffect(() => {
    if (!solPrice && unit === 'usd' && preset !== null) {
      setUnit('sol')
      setPreset(0.1)
    }
  }, [solPrice, unit, preset])

  const value = preset ?? parseFloat(custom || '0')
  const sol = unit === 'sol' ? value : solPrice ? value / solPrice : 0
  const usd = unit === 'usd' ? value : solPrice ? value * solPrice : 0
  const impact = usd > 0 ? describeImpact(cause, usd) : null
  const presets = unit === 'usd' ? USD_PRESETS : SOL_PRESETS
  const valid = sol >= MIN_SOL && isFinite(sol)
  const enough = balance == null || balance >= sol + 0.0015

  useEffect(() => {
    if (!privateRoute || !(sol > 0)) return
    apiSend<{ success: boolean; configured?: boolean; preview?: { percentFeeLamports: number; integratorShareLamports: number; estimatedArrivalSeconds: number } }>('/api/multihopper/route', { action: 'estimate', amount: sol, hops: 3 })
      .then((r) => r.preview && setMh({ configured: !!r.configured, feeSol: r.preview.percentFeeLamports / 1e9, shareSol: r.preview.integratorShareLamports / 1e9, minutes: Math.round(r.preview.estimatedArrivalSeconds / 60) }))
      .catch(() => {})
  }, [privateRoute, sol])

  const create = async () => {
    setCreating(true)
    const r = await createWallet()
    setCreating(false)
    if (!r.ok) toast(r.error || 'Could not create a wallet', 'err')
    else if (!isMainnet) toast(r.funded ? 'Wallet created and topped up with devnet SOL.' : 'Wallet created.', 'ok')
  }

  const go = async () => {
    if (!signer || !valid) return
    if (privateRoute) {
      const r = await apiSend<{ success: boolean; error?: string; id?: string }>('/api/multihopper/route', { action: 'create', amount: sol, hops: 3, poolId: causeId, source: signer.publicKey.toBase58() })
      if (!r.success) return toast(r.error || 'Private route unavailable right now', 'err')
      return toast('Private route created. Continue in the MultiHopper step.', 'ok')
    }
    const r = await donate(causeId, sol, { anonymous, dareId: req.dareId })
    if (r) setResult(r)
  }

  if (result) return <Success result={result} causeId={causeId} usd={usd} onClose={onClose} />

  return (
    <div className="pt-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[30px] leading-[1.05]">Give</h3>
          <p className="text-[13.5px] text-[#6e6e73] mt-1">Held in escrow on Solana until the delivery is proven.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-[#6e6e73] hover:bg-black/[0.05]">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Cause */}
      <div className="mt-5 -mx-6 px-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          {CAUSES.map((c) => {
            const on = c.id === causeId
            return (
              <button key={c.id} onClick={() => setCauseId(c.id)} className={`flex items-center gap-2 pl-1 pr-3 h-10 rounded-full border transition-all ${on ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-black/[0.08] bg-white hover:border-black/30'}`}>
                <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-black/[0.05]">
                  <Img src={c.image.replace(/w=\d+/, 'w=96')} alt="" />
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap">{c.shortName}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Amount */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12.5px] font-semibold">Amount</span>
          <div className="inline-flex bg-black/[0.05] rounded-full p-0.5">
            {(['usd', 'sol'] as const).map((u) => (
              <button
                key={u}
                onClick={() => {
                  if (u === unit) return
                  setUnit(u)
                  setPreset(u === 'usd' ? 25 : 0.1)
                  setCustom('')
                }}
                disabled={u === 'usd' && !solPrice}
                className={`px-3 h-7 rounded-full text-[11.5px] font-semibold transition-all ${unit === u ? 'bg-white shadow-sm' : 'text-[#6e6e73]'} disabled:opacity-40`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreset(p)
                setCustom('')
              }}
              className={`h-11 rounded-xl text-[14px] font-semibold num transition-all ${preset === p ? 'bg-[#1d1d1f] text-white' : 'bg-black/[0.04] hover:bg-black/[0.07]'}`}
            >
              {unit === 'usd' ? `$${p}` : p}
            </button>
          ))}
        </div>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aeaeb2] text-[15px]">{unit === 'usd' ? '$' : '◎'}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step={unit === 'usd' ? '1' : '0.01'}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setPreset(null)
            }}
            placeholder={unit === 'usd' ? 'Other amount' : 'Other amount in SOL'}
            className={`input !pl-9 num ${preset === null && custom ? '!border-[#1d1d1f]' : ''}`}
          />
        </div>
        <div className="flex items-center justify-between mt-2 min-h-[18px]">
          <p className="text-[12.5px] text-[#6e6e73]">
            {valid ? (
              <>
                {unit === 'usd' ? `${fmtSol(sol, 4)} SOL` : solPrice ? fmtUsd(usd) : ''}
                {impact && (
                  <>
                    {' '}
                    · about <span className="text-[#047857] font-semibold">{impact}</span>
                  </>
                )}
              </>
            ) : (
              'Enter an amount'
            )}
          </p>
          <span className="text-[11.5px] text-[#aeaeb2] num">+{Math.floor(sol * 1000)} pts</span>
        </div>
      </div>

      {/* Method */}
      <div className="mt-5">
        <span className="text-[12.5px] font-semibold block mb-2">Pay with</span>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/[0.04] rounded-2xl">
          {(
            [
              ['solana', 'Solana wallet', 'SOL · one tap'],
              ['anychain', 'Any chain', 'USDC, ETH, BTC, TON…'],
            ] as const
          ).map(([id, label, sub]) => (
            <button key={id} onClick={() => setMethod(id)} className={`rounded-[14px] px-3 py-2.5 text-left transition-all ${method === id ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}>
              <span className="block text-[13px] font-semibold">{label}</span>
              <span className="block text-[11px] text-[#6e6e73]">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {method === 'solana' ? (
        <div className="mt-4">
          {!signer ? (
            <div className="rounded-2xl border border-black/[0.08] p-4">
              <p className="text-[13.5px] font-semibold">You need a wallet to give</p>
              <p className="text-[12.5px] text-[#6e6e73] mt-0.5">Create one in a tap, or connect Phantom, Solflare or Backpack.</p>
              <div className="flex gap-2 mt-3">
                <Btn className="flex-1" icon="bolt" onClick={create} loading={creating}>
                  Create wallet
                </Btn>
                <Btn tone="outline" className="flex-1" icon="wallet" onClick={connectWallet}>
                  Connect
                </Btn>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/[0.08] p-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-black/[0.05] flex items-center justify-center text-[#1d1d1f]">
                <Icon name={signer.kind === 'local' ? 'bolt' : 'wallet'} size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{signer.kind === 'local' ? 'Umanity wallet' : 'Connected wallet'} {user?.handleClaimed ? `· @${user.username}` : ''}</p>
                <p className="text-[12px] text-[#6e6e73] num">
                  {balance == null ? '…' : `${fmtSol(balance, 3)} SOL`} {solPrice && balance != null ? `· ${fmtUsd(balance * solPrice)}` : ''}
                </p>
              </div>
              {!enough ? (
                isMainnet ? (
                  <Btn size="sm" tone="outline" onClick={openWalletSheet}>
                    Add funds
                  </Btn>
                ) : (
                  <Btn size="sm" tone="outline" onClick={() => requestFaucet().then((r) => toast(r.ok ? (r.funded ? 'Topped up with devnet SOL.' : 'Already funded.') : r.error || 'Faucet failed', r.ok ? 'ok' : 'err'))}>
                    Get devnet SOL
                  </Btn>
                )
              ) : (
                <Pill tone="green" dot>
                  Ready
                </Pill>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 gap-4">
            <Toggle on={anonymous} onChange={setAnonymous} label={<span className="text-[13px]">Give anonymously</span>} />
            <Toggle on={privateRoute} onChange={setPrivateRoute} label={<span className="text-[13px]">Private route</span>} />
          </div>
          {privateRoute && (
            <p className="text-[11.5px] text-[#6e6e73] mt-2 leading-relaxed">
              Routed through MultiHopper in 3 timed hops with TRM screening. Fee 0.5% ({mh ? fmtSol(mh.feeSol, 4) : '…'} SOL), arrives in about {mh?.minutes ?? 10} minutes. {mh && !mh.configured ? 'Preview only until a routing key is configured on this deployment.' : ''}
            </p>
          )}

          <Btn tone="accent" size="xl" full className="mt-5" onClick={go} loading={busy} disabled={!signer || !valid || (!enough && !privateRoute)}>
            {valid ? (privateRoute ? `Route ${fmtSol(sol, 3)} SOL privately` : `Give ${unit === 'usd' ? fmtUsd(usd) : `${fmtSol(sol, 3)} SOL`}`) : 'Give'}
          </Btn>
          <p className="text-[11px] text-[#aeaeb2] text-center mt-2.5">No platform fee on gifts. Your gift is recorded on-chain and verified by the server before it counts.</p>
        </div>
      ) : (
        <AnyChain causeId={causeId} usd={usd} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Success                                                             */
/* ------------------------------------------------------------------ */
function Success({ result, causeId, usd, onClose }: { result: DonateResult; causeId: string; usd: number; onClose: () => void }) {
  const cause = getCause(causeId)!
  const { solPrice } = useUmanity()
  const shownUsd = usd > 0 ? usd : solPrice ? result.amount * solPrice : 0
  const impact = shownUsd > 0 ? describeImpact(cause, shownUsd) : null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const share = () => {
    const text = `I just gave ${shownUsd > 0 ? fmtUsd(shownUsd) : `${fmtSol(result.amount, 3)} SOL`} to ${cause.name} on @umanity_xyz. It stays in escrow on Solana until the delivery is proven.\n\n${origin}/causes/${cause.id}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  return (
    <div className="text-center pt-6 pb-2">
      <div className="w-16 h-16 rounded-full bg-[#10b981] text-white flex items-center justify-center mx-auto check-pop">
        <Icon name="check" size={30} strokeWidth={2.5} />
      </div>
      <h3 className="font-display text-[36px] leading-none mt-5">Thank you.</h3>
      <p className="text-[15px] text-[#1d1d1f] mt-3">
        You gave <span className="font-semibold num">{shownUsd > 0 ? fmtUsd(shownUsd) : ''}</span>
        {shownUsd > 0 ? ' (' : ''}
        <span className="num">{fmtSol(result.amount, 3)} SOL</span>
        {shownUsd > 0 ? ')' : ''} to <span className="font-semibold">{cause.name}</span>.
      </p>
      {impact && (
        <p className="text-[14px] text-[#047857] mt-1">
          About <span className="font-semibold">{impact}</span>.
        </p>
      )}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        <Pill tone="green">+{result.points} points</Pill>
        <Pill tone="gray" className="capitalize">
          {result.tier} certificate
        </Pill>
        {result.milestoneProposals.length > 0 && <Pill tone="amber">A release vote just opened</Pill>}
      </div>
      <div className="mt-3">
        <TxLink sig={result.signature} label="View on Solscan" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-6">
        <Btn tone="outline" size="lg" icon="share" onClick={share}>
          Share
        </Btn>
        <a href={`/home?compose=dare&cause=${cause.id}&amount=${result.amount}`} className="btn btn-outline h-12 px-6 text-[15px]" onClick={onClose}>
          <Icon name="bolt" size={16} /> Dare a friend
        </a>
      </div>
      <Btn size="lg" full className="mt-2" onClick={onClose}>
        Done
      </Btn>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Any chain (NEAR Intents / Aurora Intents, mainnet settlement)       */
/* ------------------------------------------------------------------ */
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
  quote: { depositAddress?: string; depositMemo?: string; amountInFormatted: string; amountInUsd?: string; amountOutFormatted: string; amountOutUsd?: string; timeEstimate?: number; deadline?: string }
  fee: { bps: number; usd: number | null; note: string }
}

function AnyChain({ causeId, usd }: { causeId: string; usd: number }) {
  const { address, toast } = useUmanity()
  const [chains, setChains] = useState<Chain[] | null>(null)
  const [meta, setMeta] = useState<{ chainCount: number; tokenCount: number; provider: string } | null>(null)
  const [chainId, setChainId] = useState('base')
  const [assetId, setAssetId] = useState('')
  const [amount, setAmount] = useState('')
  const [refundTo, setRefundTo] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [live, setLive] = useState<{ intentId: string; status: string; settlementSignature?: string | null; explorerUrl?: string | null } | null>(null)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiGet<{ success: boolean; chains?: Chain[]; chainCount?: number; tokenCount?: number; provider?: string; error?: string }>('/api/intents/tokens', { timeoutMs: 25_000 })
      .then((d) => {
        if (!d.success) throw new Error(d.error)
        setChains(d.chains ?? [])
        setMeta({ chainCount: d.chainCount ?? 0, tokenCount: d.tokenCount ?? 0, provider: d.provider ?? 'oneclick' })
        const base = d.chains?.find((c) => c.id === 'base') ?? d.chains?.[0]
        if (base) {
          setChainId(base.id)
          const usdc = base.tokens.find((t) => t.symbol === 'USDC') ?? base.tokens[0]
          if (usdc) setAssetId(usdc.assetId)
        }
      })
      .catch((e) => {
        setChains([])
        setError(`Could not load the chain list: ${e instanceof Error ? e.message : e}`)
      })
  }, [])

  const chain = chains?.find((c) => c.id === chainId)
  const token = chain?.tokens.find((t) => t.assetId === assetId)

  // Default the amount from the USD choice for dollar-pegged assets.
  useEffect(() => {
    if (!token) return
    if (/USD/i.test(token.symbol) && usd > 0) setAmount(String(Math.round(usd * 100) / 100))
    else if (token.price && usd > 0) setAmount(String(Number((usd / token.price).toPrecision(4))))
  }, [token, usd])

  const getQuote = useCallback(
    async (dry: boolean) => {
      if (!assetId || !(parseFloat(amount) > 0)) return
      setQuoting(true)
      setError('')
      try {
        const r = await apiSend<{ success: boolean; error?: string; needsRefundAddress?: boolean } & Quote>('/api/intents/quote', { originAsset: assetId, amount, poolId: causeId, dry, refundTo: refundTo || undefined, userAddress: address || undefined }, 'POST', { timeoutMs: 40_000 })
        if (!r.success) {
          if (r.needsRefundAddress) setQuote(null)
          throw new Error(r.error)
        }
        setQuote(r)
        if (!dry && r.intentId) {
          setLive({ intentId: r.intentId, status: 'pending_deposit' })
          toast('Deposit address ready. Send the funds from your wallet or exchange.', 'ok')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Quote failed')
      } finally {
        setQuoting(false)
      }
    },
    [assetId, amount, causeId, refundTo, address, toast]
  )

  useEffect(() => {
    if (!assetId || live) return
    const t = setTimeout(() => getQuote(true), 600)
    return () => clearTimeout(t)
  }, [assetId, amount, causeId, getQuote, live])

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

  const submitHash = async () => {
    if (!live || !txHash.trim()) return
    const r = await apiSend<{ success: boolean; error?: string }>('/api/intents/deposit-submit', { intentId: live.intentId, txHash: txHash.trim() })
    toast(r.success ? 'Thanks, we are tracking that deposit.' : r.error || 'Could not submit', r.success ? 'ok' : 'err')
  }

  const steps = ['Quote', 'Send deposit', 'Swapping', 'Settled on Solana']
  const stepIdx = !live ? 0 : live.status === 'pending_deposit' ? 1 : live.status === 'processing' ? 2 : live.status === 'success' ? 3 : -1

  return (
    <div className="mt-4">
      {chains === null ? (
        <Skeleton className="h-40" />
      ) : chains.length === 0 ? (
        <p className="text-[12.5px] text-[#c53030]">{error || 'Cross-chain giving is unavailable right now.'}</p>
      ) : (
        <>
          {!live && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <select
                    value={chainId}
                    onChange={(e) => {
                      setChainId(e.target.value)
                      const c = chains.find((x) => x.id === e.target.value)
                      const t = c?.tokens.find((t) => t.symbol === 'USDC') ?? c?.tokens[0]
                      if (t) setAssetId(t.assetId)
                    }}
                    className="input !py-2.5 !text-[14px]"
                  >
                    {chains.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Asset">
                  <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input !py-2.5 !text-[14px]">
                    {chain?.tokens.map((t) => (
                      <option key={t.assetId} value={t.assetId}>
                        {t.symbol}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-2">
                <Field label={`Amount in ${token?.symbol ?? ''}`}>
                  <input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input num" />
                </Field>
              </div>
            </>
          )}

          {/* Quote */}
          <div className="mt-3 rounded-2xl bg-[#fafafa] border border-black/[0.06] p-4">
            {quoting && !quote ? (
              <Skeleton className="h-10" />
            ) : quote ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11.5px] text-[#6e6e73]">You send</p>
                  <p className="num font-semibold text-[15px]">
                    {quote.quote.amountInFormatted} {quote.token.symbol}
                  </p>
                </div>
                <Icon name="arrowRight" size={16} className="text-[#aeaeb2]" />
                <div className="text-right">
                  <p className="text-[11.5px] text-[#6e6e73]">Cause receives</p>
                  <p className="num font-semibold text-[15px] text-[#047857]">{quote.quote.amountOutFormatted} SOL</p>
                  <p className="text-[11px] text-[#6e6e73] num">
                    {quote.quote.amountOutUsd ? `≈ ${fmtUsd(Number(quote.quote.amountOutUsd))}` : ''} · ~{quote.quote.timeEstimate ?? 120}s
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#6e6e73]">{error || 'Live quote from the NEAR Intents solver network.'}</p>
            )}
          </div>

          {!live ? (
            <>
              <div className="mt-3">
                <Field label={`Refund address on ${chain?.label ?? 'the origin chain'}`} hint="If the deposit cannot be filled, funds come back here.">
                  <input value={refundTo} onChange={(e) => setRefundTo(e.target.value.trim())} placeholder={chain?.id === 'sol' ? 'Your Solana address' : chain?.id === 'btc' ? 'bc1…' : chain?.id === 'near' ? 'you.near' : '0x…'} className="input num !text-[13px]" />
                </Field>
              </div>
              <Btn tone="accent" size="xl" full className="mt-4" onClick={() => getQuote(false)} loading={quoting && !!quote} disabled={!quote || !refundTo}>
                Get deposit address
              </Btn>
              <p className="text-[11px] text-[#aeaeb2] text-center mt-2.5">
                {meta ? `${meta.chainCount} chains · ${meta.tokenCount} assets` : ''} · Settles on Solana mainnet · 0.5% routing fee funds Umanity
              </p>
            </>
          ) : (
            quote?.quote.depositAddress && (
              <div className="mt-3">
                <div className="grid grid-cols-[112px_1fr] gap-4 items-start">
                  <div className="bg-white border border-black/[0.06] rounded-2xl p-2">
                    <QRCodeSVG value={quote.quote.depositAddress} size={96} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">
                      Send exactly {quote.quote.amountInFormatted} {quote.token.symbol} on {chain?.label}
                    </p>
                    <p className="num text-[12px] break-all mt-1 p-2 rounded-lg bg-black/[0.04]">{quote.quote.depositAddress}</p>
                    {quote.quote.depositMemo && (
                      <p className="text-[11.5px] mt-1">
                        Memo: <span className="num">{quote.quote.depositMemo}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <CopyButton text={quote.quote.depositAddress} label="Copy address" />
                      <a href={`${INTENTS_EXPLORER}/?search=${quote.quote.depositAddress}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[#047857] hover:underline inline-flex items-center gap-1">
                        Explorer <Icon name="arrowUpRight" size={12} />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                  {steps.map((s, i) => (
                    <span key={s} className={`pill ${stepIdx === i ? 'bg-[#1d1d1f] text-white' : stepIdx > i ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-black/[0.05] text-[#aeaeb2]'}`}>
                      {stepIdx === i && stepIdx < 3 ? <Spinner className="!w-3 !h-3" /> : stepIdx > i || stepIdx === 3 ? <Icon name="check" size={11} /> : null}
                      {s}
                    </span>
                  ))}
                  {live.status === 'refunded' && <Pill tone="amber">Refunded</Pill>}
                  {live.status === 'failed' && <Pill tone="red">Failed</Pill>}
                </div>
                {live.settlementSignature && (
                  <a href={live.explorerUrl || explorerTx(live.settlementSignature, 'mainnet-beta')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#047857] hover:underline mt-2">
                    Settlement transaction <Icon name="arrowUpRight" size={12} />
                  </a>
                )}
                {stepIdx === 1 && (
                  <div className="flex gap-2 mt-3">
                    <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="Deposit tx hash (optional, speeds up tracking)" className="input !py-2 !text-[12px] num" />
                    <Btn size="md" tone="secondary" onClick={submitHash} disabled={!txHash.trim()}>
                      Submit
                    </Btn>
                  </div>
                )}
                <p className="text-[11px] text-[#aeaeb2] mt-3">Valid until {quote.quote.deadline ? new Date(quote.quote.deadline).toLocaleTimeString() : 'the quote expires'}. Under-deposits are refunded to your address.</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
