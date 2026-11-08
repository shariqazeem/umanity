'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { apiGet, apiSend } from '@/lib/client/api'
import { usdText } from '@/lib/umanity/drops'

type Token = { assetId: string; symbol: string; blockchain: string; decimals: number }
type Chain = { id: string; label: string; short: string; tokens: Token[] }
type Quote = {
  live: boolean
  intentId: string | null
  depositAddress: string | null
  depositMemo: string | null
  amountInFormatted: string
  amountInUsd: string | null
  amountUsd: number
  deadline: string | null
  timeEstimate: number | null
  asset: { id: string; symbol: string; chain: string; chainLabel: string }
  feeBps: number
}
type IntentView = {
  id: string
  status: string
  settled: boolean
  signature: string | null
  intoPotUsd: number | null
  returnedUsd: number | null
  refund: { amount: string | null; reason: string | null } | null
  shortfall: { received: string | null; expected: string | null } | null
}

/** Where people usually hold money outside Solana: stablecoins and majors on their home chains. */
const POPULAR: [string, string][] = [
  ['USDC', 'base'],
  ['USDC', 'arb'],
  ['USDC', 'eth'],
  ['ETH', 'base'],
  ['ETH', 'eth'],
  ['BTC', 'btc'],
  ['NEAR', 'near'],
  ['USDT', 'tron'],
]

function statusText(i: IntentView | null): { text: string; tone: 'wait' | 'ok' | 'warn' } {
  switch (i?.status) {
    case 'processing':
      return { text: 'Deposit seen. Swapping it into USDC on Solana…', tone: 'wait' }
    case 'incomplete_deposit':
      return { text: `Only ${i.shortfall?.received ?? 'part'} of ${i.shortfall?.expected ?? 'the amount'} arrived. Send the rest to the same address before the quote runs out, or it's refunded.`, tone: 'warn' }
    case 'success':
      return { text: 'Arrived on Solana. Putting it in the pot…', tone: 'wait' }
    case 'in_pot':
      return { text: 'In the pot ✓', tone: 'ok' }
    case 'refunded':
      return { text: `The swap didn't go through, so NEAR Intents sent ${i.refund?.amount ?? 'your deposit'} back to your address.${i.refund?.reason ? ` (${i.refund.reason})` : ''}`, tone: 'warn' }
    case 'failed':
      return { text: 'The network is retrying the swap…', tone: 'wait' }
    default:
      return { text: 'Waiting for your deposit…', tone: 'wait' }
  }
}

/**
 * Gives to a drop from 30+ chains with Aurora Intents: pick what you hold, send
 * it to a one-off address, and the exact USDC lands in the pot in your name.
 */
export function AnyChainGive({ dropId, amountUsd, onBack, onDone }: { dropId: number; amountUsd: number; onBack: () => void; onDone: (signature: string, amountUsd: number, returnedUsd: number | null) => void }) {
  const { signer, ensureSigner, isMainnet, toast } = useUmanity()
  const [chains, setChains] = useState<Chain[] | null>(null)
  const [asset, setAsset] = useState('')
  const [preview, setPreview] = useState<Quote | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [refundTo, setRefundTo] = useState('')
  const [live, setLive] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intent, setIntent] = useState<IntentView | null>(null)
  const [txHash, setTxHash] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    apiGet<{ chains?: Chain[]; error?: string }>('/api/intents/tokens')
      .then((r) => {
        if (!r.chains) return setPreviewError(r.error || 'Could not load the assets')
        setChains(r.chains)
        const usdcBase = r.chains.find((c) => c.id === 'base')?.tokens.find((t) => t.symbol === 'USDC')
        setAsset((a) => a || usdcBase?.assetId || r.chains![0]?.tokens[0]?.assetId || '')
      })
      .catch(() => setPreviewError('Could not load the assets'))
  }, [])

  const byId = useMemo(() => {
    const m = new Map<string, { token: Token; chain: Chain }>()
    for (const c of chains ?? []) for (const t of c.tokens) m.set(t.assetId, { token: t, chain: c })
    return m
  }, [chains])
  const popular = useMemo(
    () => POPULAR.map(([sym, ch]) => chains?.find((c) => c.id === ch)?.tokens.find((t) => t.symbol === sym)).filter((t): t is Token => !!t),
    [chains],
  )
  const picked = byId.get(asset)

  // A free price preview whenever the asset or amount changes.
  useEffect(() => {
    if (!asset || live) return
    setPreview(null)
    setPreviewError(null)
    const t = setTimeout(async () => {
      const r = await apiSend<{ quote?: Quote; error?: string }>(`/api/drops/${dropId}/intents`, { originAsset: asset, amountUsd, backer: signer?.publicKey.toBase58() }).catch(() => ({ error: 'Could not get a price' }) as { quote?: Quote; error?: string })
      if (r.quote) setPreview(r.quote)
      else setPreviewError(r.error || 'Could not get a price')
    }, 350)
    return () => clearTimeout(t)
  }, [asset, amountUsd, dropId, live, signer])

  // Once there's a deposit address, follow the gift until it's in the pot.
  useEffect(() => {
    if (!live?.intentId) return
    let stop = false
    const tick = async () => {
      const r = await apiGet<{ intent?: IntentView }>(`/api/drops/intents/${live.intentId}`, { timeoutMs: 55_000 }).catch(() => null)
      if (stop || !r?.intent) return
      setIntent(r.intent)
      if (r.intent.settled && r.intent.signature) {
        stop = true
        onDone(r.intent.signature, r.intent.intoPotUsd ?? amountUsd, r.intent.returnedUsd)
      }
    }
    tick()
    const iv = setInterval(tick, 6000)
    const clock = setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      stop = true
      clearInterval(iv)
      clearInterval(clock)
    }
    // onDone and amountUsd are fixed for the life of one deposit address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.intentId])

  const start = async () => {
    const s = ensureSigner()
    if (!s || !asset) return
    setBusy(true)
    setError(null)
    const r = await apiSend<{ quote?: Quote; error?: string }>(`/api/drops/${dropId}/intents`, { originAsset: asset, amountUsd, live: true, refundTo, backer: s.publicKey.toBase58() }).catch(
      () => ({ error: 'Could not open a deposit address' }) as { quote?: Quote; error?: string },
    )
    setBusy(false)
    if (r.quote?.depositAddress) setLive(r.quote)
    else setError(r.error || 'Could not open a deposit address')
  }

  const sendHash = async () => {
    if (!live?.intentId || !txHash.trim()) return
    const r = await apiSend<{ ok?: boolean; error?: string }>(`/api/drops/intents/${live.intentId}`, { txHash: txHash.trim() }).catch(() => ({ error: 'Could not send it' }) as { ok?: boolean; error?: string })
    if (r.ok) toast('Thanks, that speeds it up', 'ok')
    else toast(r.error || 'Could not send it', 'err')
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast('Copied', 'ok'))
  const minutesLeft = live?.deadline ? Math.max(0, Math.round((new Date(live.deadline).getTime() - now) / 60_000)) : null
  const status = statusText(intent)

  return (
    <div>
      <button onClick={onBack} className="text-[12.5px] font-semibold text-[#86868b] hover:text-[#1d1d1f]">
        ← Pay from my Solana wallet
      </button>
      <p className="text-[18px] font-bold tracking-tight mt-2">Give {usdText(amountUsd, amountUsd % 1 ? 2 : 0)} from any chain</p>
      <p className="text-[12.5px] text-[#525252] mt-1">Pay with what you already hold. Aurora Intents swaps it into USDC on Solana and the exact amount goes into the pot in your name.</p>

      {!live ? (
        <>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {popular.map((t) => {
              const c = byId.get(t.assetId)?.chain
              const active = asset === t.assetId
              return (
                <button key={t.assetId} onClick={() => setAsset(t.assetId)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-all ${active ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]' : 'bg-white border-black/[0.08] hover:border-black/[0.2]'}`}>
                  {t.symbol}
                  <span className={active ? 'text-white/60' : 'text-[#86868b]'}> · {c?.label}</span>
                </button>
              )
            })}
          </div>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="input w-full mt-2 !text-[13px]" aria-label="All assets">
            {!chains && <option>Loading assets…</option>}
            {chains?.map((c) => (
              <optgroup key={c.id} label={c.label}>
                {c.tokens.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol} on {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="mt-3 rounded-2xl bg-[#f5f5f7] p-4 min-h-[72px]">
            {preview ? (
              <>
                <p className="text-[13px] text-[#525252]">You send</p>
                <p className="text-[18px] font-bold counter">
                  {preview.amountInFormatted} {preview.asset.symbol}
                  <span className="text-[12.5px] font-semibold text-[#86868b]"> on {preview.asset.chainLabel}{preview.amountInUsd ? ` · about ${usdText(Number(preview.amountInUsd), 2)}` : ''}</span>
                </p>
                <p className="text-[12.5px] text-[#525252] mt-1">
                  {usdText(preview.amountUsd, preview.amountUsd % 1 ? 2 : 0)} lands in the pot{preview.timeEstimate ? `, usually in about ${Math.max(1, Math.round(preview.timeEstimate / 60))} min` : ''}.{' '}
                  {preview.feeBps > 0 ? `The price includes the swap and a ${(preview.feeBps / 100).toFixed(1)}% Umanity fee.` : 'The price includes the swap and network costs.'}
                </p>
              </>
            ) : previewError ? (
              <p className="text-[12.5px] text-red-600">{previewError}</p>
            ) : (
              <div className="skeleton h-10" />
            )}
          </div>

          {isMainnet ? (
            <>
              <input value={refundTo} onChange={(e) => setRefundTo(e.target.value)} placeholder={`Your ${picked?.chain.label ?? ''} address, for a refund if the swap fails`} className="input w-full mt-3 !text-[13px]" />
              {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
              <button onClick={start} disabled={busy || !preview || !refundTo.trim()} className="btn-primary w-full py-3.5 mt-3 !text-[15px]">
                {busy ? 'Opening a deposit address…' : signer ? 'Get my deposit address' : 'Sign in to give'}
              </button>
            </>
          ) : (
            <p className="mt-3 text-[12.5px] text-[#86868b]">Cross-chain gifts settle on Solana mainnet, because NEAR Intents has no test network. Here on devnet you can see live prices.</p>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-black/[0.06] p-4">
            <p className="text-[12.5px] text-[#525252]">
              Send exactly <span className="font-bold text-[#1d1d1f]">{live.amountInFormatted} {live.asset.symbol}</span> on {live.asset.chainLabel} to:
            </p>
            <div className="flex gap-3 items-start mt-3">
              <div className="bg-white p-1.5 rounded-xl border border-black/[0.06] flex-shrink-0">
                <QRCodeSVG value={live.depositAddress!} size={84} />
              </div>
              <button onClick={() => copy(live.depositAddress!)} className="flex-1 text-left font-mono text-[11.5px] bg-[#f5f5f7] rounded-xl px-3 py-2.5 hover:bg-[#ececef] break-all" title="Copy">
                {live.depositAddress}
              </button>
            </div>
            {live.depositMemo && (
              <button onClick={() => copy(live.depositMemo!)} className="mt-2 w-full text-left text-[12px] bg-amber-50 text-amber-800 rounded-xl px-3 py-2">
                Include this memo, or the deposit can't be matched: <span className="font-mono font-semibold">{live.depositMemo}</span>
              </button>
            )}
            {minutesLeft != null && <p className="text-[11.5px] text-[#86868b] mt-2">This address takes the deposit for about {minutesLeft} more min. Send from any wallet or exchange.</p>}
          </div>

          <div className={`mt-3 rounded-2xl p-4 text-[13px] ${status.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : status.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>
            <span className="inline-flex items-center gap-2">
              {status.tone === 'wait' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              {status.text}
            </span>
          </div>

          {(!intent || intent.status === 'pending_deposit') && (
            <div className="flex gap-2 mt-2">
              <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="Sent it? Paste the transaction hash (optional)" className="input flex-1 !text-[12.5px]" />
              <button onClick={sendHash} disabled={!txHash.trim()} className="btn-secondary px-4 !text-[12.5px]">
                Send
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-[#aeaeb2] text-center mt-4">
        Powered by Aurora Intents on NEAR Intents. If the swap fails, NEAR Intents refunds you on your chain; if the drop isn&apos;t delivered, the program refunds you on Solana.
      </p>
    </div>
  )
}
