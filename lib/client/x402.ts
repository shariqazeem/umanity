'use client'

/**
 * Browser-side x402 payer. Bridges a wallet-adapter / demo-wallet signer into
 * a @solana/kit TransactionPartialSigner and wraps fetch so a 402 response is
 * paid automatically (USDC on Solana) and retried.
 */
import { VersionedTransaction } from '@solana/web3.js'
import type { Signer } from '@/components/providers/UmanityProvider'

export interface X402Result<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
  settlement?: { success: boolean; transaction?: string; network?: string; payer?: string }
}

export async function payWithX402<T = Record<string, unknown>>(signer: Signer, path: string, body: unknown): Promise<X402Result<T>> {
  const [{ wrapFetchWithPayment, x402Client, decodePaymentResponseHeader }, { ExactSvmScheme }, kit] = await Promise.all([import('@x402/fetch'), import('@x402/svm/exact/client'), import('@solana/kit')])
  const { address, getTransactionEncoder, getTransactionDecoder } = kit
  const addr = address(signer.publicKey.toBase58())
  const encoder = getTransactionEncoder()
  const decoder = getTransactionDecoder()

  // Kit transaction → web3.js VersionedTransaction → wallet signs → extract our signature
  const partialSigner = {
    address: addr,
    signTransactions: async (txs: Parameters<typeof encoder.encode>[0][]) =>
      Promise.all(
        txs.map(async (tx) => {
          const bytes = new Uint8Array(encoder.encode(tx))
          const vtx = VersionedTransaction.deserialize(bytes)
          const signed = await signer.signTransaction(vtx)
          const idx = signed.message.staticAccountKeys.findIndex((k) => k.equals(signer.publicKey))
          if (idx < 0) throw new Error('Signer not in transaction')
          const decoded = decoder.decode(signed.serialize())
          const sig = decoded.signatures[addr] ?? signed.signatures[idx]
          return { [addr]: sig } as Record<string, Uint8Array>
        })
      ),
  }
  const client = new x402Client().register('solana:*' as `${string}:${string}`, new ExactSvmScheme(partialSigner as never))
  const payFetch = wrapFetchWithPayment(fetch, client)
  let res: Response
  try {
    res = await payFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'payment failed' }
  }
  let data: T | undefined
  let error: string | undefined
  try {
    const j = (await res.json()) as T & { error?: string }
    data = j
    error = j?.error
  } catch {
    /* ignore */
  }
  const pr = res.headers.get('payment-response') || res.headers.get('x-payment-response')
  let settlement: X402Result['settlement']
  if (pr) {
    try {
      settlement = decodePaymentResponseHeader(pr) as X402Result['settlement']
    } catch {
      /* ignore */
    }
  }
  return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : error || `HTTP ${res.status}`, settlement }
}
