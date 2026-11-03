'use client'

/**
 * Browser-side x402 payer. Bridges a wallet-adapter / Umanity wallet signer
 * into a @solana/kit TransactionModifyingSigner and wraps fetch so a 402
 * response is paid automatically (USDC on Solana) and retried.
 *
 * The signer hands back the wallet's whole signed transaction rather than
 * only its signature: on mainnet Phantom and Solflare add instructions
 * (Lighthouse) before signing, and a signature over the original message
 * would not match what they signed.
 */
import { VersionedTransaction } from '@solana/web3.js'
import type { Signer } from '@/components/providers/UmanityProvider'
import { SOLANA_RPC } from '@/lib/solana/constants'

export interface X402Result<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
  /** Machine reason from the facilitator (e.g. invalid_exact_svm_transaction_simulation_failed). */
  reason?: string
  settlement?: { success: boolean; transaction?: string; network?: string; payer?: string }
}

/** Plain-language versions of the facilitator's failure reasons. */
export function explainX402(reason?: string, fallback?: string): string {
  const r = (reason || fallback || '').toLowerCase()
  if (r.includes('simulation') || r.includes('insufficient') || r.includes('balance')) return 'This wallet does not have enough USDC (or has no USDC account yet).'
  if (r.includes('blockhash') || r.includes('expired')) return 'The payment expired before it was sent. Try again.'
  if (r.includes('already_used') || r.includes('replay')) return 'That payment was already used. Sign a new one.'
  if (r.includes('rejected') || r.includes('declined')) return 'Cancelled in your wallet.'
  if (r.includes('facilitator_unavailable')) return 'The payment network is busy. Try again in a few seconds.'
  return fallback || reason || 'Payment failed'
}

export async function payWithX402<T = Record<string, unknown>>(signer: Signer, path: string, body: unknown): Promise<X402Result<T>> {
  const [{ wrapFetchWithPayment, x402Client, x402HTTPClient, decodePaymentResponseHeader }, { ExactSvmScheme }, kit] = await Promise.all([import('@x402/fetch'), import('@x402/svm/exact/client'), import('@solana/kit')])
  const { address, getTransactionEncoder, getTransactionDecoder } = kit
  const enc = getTransactionEncoder()
  const dec = getTransactionDecoder()

  type KitTx = Parameters<typeof enc.encode>[0]
  const modifyingSigner = {
    address: address(signer.publicKey.toBase58()),
    modifyAndSignTransactions: async (txs: readonly KitTx[]) => {
      const out: KitTx[] = []
      for (const tx of txs) {
        const signed = await signer.signTransaction(VersionedTransaction.deserialize(new Uint8Array(enc.encode(tx))))
        // Keep the lifetime the scheme attached; take everything else from what the wallet signed.
        out.push({ ...dec.decode(signed.serialize()), lifetimeConstraint: (tx as KitTx & { lifetimeConstraint?: unknown }).lifetimeConstraint } as KitTx)
      }
      return out
    },
  }
  const client = new x402Client()
    .register('solana:*' as `${string}:${string}`, new ExactSvmScheme(modifyingSigner as never, { rpcUrl: SOLANA_RPC }))
    .setSpendControls({ maxAmountPerPayment: '$250' })
  const payFetch = wrapFetchWithPayment(fetch, client)

  let res: Response
  try {
    res = await payFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'payment failed'
    return { ok: false, status: 0, error: explainX402(msg, msg), reason: msg }
  }

  let reason: string | undefined
  let data: T | undefined
  let settlement: X402Result['settlement']
  try {
    const processed = await new x402HTTPClient(client).processResponse(res.clone())
    const h = processed.header as { errorReason?: string; error?: string; success?: boolean; transaction?: string; network?: string; payer?: string } | undefined
    if (h?.transaction || h?.success) settlement = { success: !!h.success, transaction: h.transaction, network: h.network, payer: h.payer }
    reason = h?.errorReason ?? h?.error
  } catch {
    /* fall back to manual parsing below */
  }
  let bodyError: string | undefined
  try {
    const j = (await res.json()) as T & { error?: string; reason?: string; message?: string }
    data = j
    bodyError = j?.message || j?.reason || j?.error
    reason = reason ?? j?.reason
  } catch {
    /* ignore */
  }
  if (!settlement) {
    const pr = res.headers.get('payment-response')
    if (pr) {
      try {
        settlement = decodePaymentResponseHeader(pr) as X402Result['settlement']
      } catch {
        /* ignore */
      }
    }
  }
  return { ok: res.ok, status: res.status, data, reason, error: res.ok ? undefined : explainX402(reason, bodyError || `HTTP ${res.status}`), settlement }
}
