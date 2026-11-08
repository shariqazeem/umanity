/**
 * x402 on Solana — server side.
 *
 * Wraps a Next.js route handler so that:
 *   1. a request whose body is invalid gets 400 and is never asked to pay;
 *   2. a valid request without PAYMENT-SIGNATURE gets HTTP 402 + PAYMENT-REQUIRED
 *      (JSON body for agents: we are an API, not a page);
 *   3. a payment is verified with the facilitator, its payer is read from the
 *      signed transfer, and a replayed payment is refused (409);
 *   4. the handler runs (pure work, no side effects); on 2xx the payment is
 *      settled on Solana, then `afterSettle` commits the side effects and the
 *      PAYMENT-RESPONSE header carries the transaction signature;
 *   5. if the handler fails, the verified payment is cancelled (never charged);
 *   6. facilitator outages answer 503 with Retry-After instead of a bare 500.
 *
 * Facilitator: x402.org on devnet (no key), PayAI on mainnet (x402.org has no
 * Solana mainnet). Asset: USDC (the exact-SVM scheme moves SPL tokens only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer, type RoutesConfig, type HTTPRequestContext, type HTTPAdapter } from '@x402/core/server'
import { ExactSvmScheme } from '@x402/svm/exact/server'
import { decodeTransactionFromPayload, getTokenPayerFromTransaction, transactionMessageHash } from '@x402/svm'
import { CAIP2_CURRENT, IS_MAINNET, SOLANA_RPC, UMANITY_TREASURY, USDC_MINT } from '@/lib/solana/constants'
import { recordX402Receipt, updateX402Receipt, findX402ReceiptByHash } from '@/lib/data/intents'

export const X402_NETWORK = CAIP2_CURRENT
export const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || (IS_MAINNET ? 'https://facilitator.payai.network' : 'https://x402.org/facilitator')
export const X402_PAY_TO = process.env.X402_PAY_TO || UMANITY_TREASURY

/** Bounds for the Give API, in USD (USDC). The agent chooses the amount. */
export const GIVE_MIN_USD = Number(process.env.X402_GIVE_MIN || '0.01')
export const GIVE_MAX_USD = Number(process.env.X402_GIVE_MAX || '250')

/** Normalises a requested gift to a USD string with at most 2 decimals inside the bounds, or null. */
export function giveAmount(raw: unknown): string | null {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (!isFinite(n) || n < GIVE_MIN_USD || n > GIVE_MAX_USD) return null
  return (Math.round(n * 100) / 100).toFixed(2)
}

export interface PaidRoute {
  path: string
  price: string
  description: string
}

export const PAID_ROUTES: Record<string, PaidRoute> = {
  give: { path: '/api/x402/give', price: 'dynamic', description: 'Put USDC into a Umanity drop pot: the payment is the gift, your wallet is the backer (refunded if the drop misses its date), and a signed receipt comes back' },
}

function usd(price: string) {
  return `$${price}`
}

function priceFor(r: PaidRoute, ctx: HTTPRequestContext) {
  if (r.price !== 'dynamic') return usd(r.price)
  const body = ctx.adapter.getBody?.() as { amountUsd?: unknown } | undefined
  return usd(giveAmount(body?.amountUsd) ?? GIVE_MIN_USD.toFixed(2))
}

function buildRoutes(): RoutesConfig {
  const routes: RoutesConfig = {}
  for (const r of Object.values(PAID_ROUTES)) {
    routes[`POST ${r.path}`] = {
      accepts: [{ scheme: 'exact', network: X402_NETWORK, payTo: X402_PAY_TO, price: (ctx: HTTPRequestContext) => priceFor(r, ctx), maxTimeoutSeconds: 120 }],
      description: r.description,
      mimeType: 'application/json',
      resource: `${process.env.NEXT_PUBLIC_APP_URL || 'https://umanity-solana.vercel.app'}${r.path}`,
      unpaidResponseBody: async (ctx: HTTPRequestContext) => ({
        contentType: 'application/json',
        body: { error: 'Payment required', x402: { network: X402_NETWORK, asset: USDC_MINT, payTo: X402_PAY_TO, price: priceFor(r, ctx), facilitator: X402_FACILITATOR_URL, howTo: 'Retry with a PAYMENT-SIGNATURE header (x402 v2). See README → x402.' } },
      }),
    }
  }
  return routes
}

type Cache = { http?: x402HTTPResourceServer; init?: Promise<void> }
const g = globalThis as unknown as { __umanityX402?: Cache }
const cache: Cache = (g.__umanityX402 ??= {})

export async function getX402Server(): Promise<x402HTTPResourceServer> {
  if (cache.http && cache.init) {
    await cache.init
    return cache.http
  }
  const facilitator = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL, timeoutMs: 30_000 })
  const core = new x402ResourceServer(facilitator).register(X402_NETWORK, new ExactSvmScheme({ rpcUrl: SOLANA_RPC }))
  const http = new x402HTTPResourceServer(core, buildRoutes())
  cache.http = http
  cache.init = http.initialize().catch((e) => {
    console.error('x402 initialize failed (facilitator unreachable?)', e)
    cache.init = undefined
    cache.http = undefined
    throw e
  })
  await cache.init
  return http
}

function adapterFor(req: NextRequest, body: unknown): HTTPAdapter {
  const url = new URL(req.url)
  return {
    getHeader: (name) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get('accept') ?? 'application/json',
    getUserAgent: () => req.headers.get('user-agent') ?? '',
    getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
    getBody: () => body,
  }
}

function unavailable(message: string) {
  return NextResponse.json({ error: 'facilitator_unavailable', message }, { status: 503, headers: { 'Retry-After': '5' } })
}

/** Payer (USDC owner) and replay key straight from the signed transfer, before settlement. */
function inspectPayment(payload: unknown): { payer?: string; hash?: string } {
  try {
    const inner = (payload as { payload?: unknown })?.payload as Parameters<typeof decodeTransactionFromPayload>[0]
    const tx = decodeTransactionFromPayload(inner)
    return { payer: getTokenPayerFromTransaction(tx) || undefined, hash: transactionMessageHash(tx) }
  } catch {
    return {}
  }
}

export interface PaidContext {
  /** The wallet that signed the USDC transfer (verified, not taken from the body). */
  payer?: string
  receiptId: string
}

export interface Settlement {
  transaction?: string
  payer?: string
  network?: string
}

export interface X402Options<T> {
  /** Reject a bad request with 400 before the client is ever asked to pay. Return an error message or null. */
  validate?: (body: T) => string | null | Promise<string | null>
  /**
   * Runs only after the payment settled on-chain. Use it for side effects that
   * must never happen for an unpaid request (recording a gift, writing an
   * attestation). Gets the handler's JSON; its result is merged into the
   * response. If it throws, the payment was still taken, so the response says
   * so and carries the receipt id for reconciliation.
   */
  afterSettle?: (body: T, paid: PaidContext, settlement: Settlement, handlerJson: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Amount actually charged, for the receipt row (defaults to the route price). */
  amountFor?: (body: T) => string
}

/**
 * Wrap a handler as an x402-paid endpoint. The handler receives the parsed
 * body and a `paid` context and returns a NextResponse; settlement happens only
 * when it returns a 2xx.
 */
export function withX402<T = Record<string, unknown>>(routeKey: keyof typeof PAID_ROUTES, handler: (body: T, paid: PaidContext, req: NextRequest) => Promise<NextResponse>, opts: X402Options<T> = {}) {
  const route = PAID_ROUTES[routeKey]
  return async (req: NextRequest): Promise<NextResponse> => {
    let body: T
    try {
      body = (await req.json()) as T
    } catch {
      body = {} as T
    }
    const invalid = await opts.validate?.(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    let server: x402HTTPResourceServer
    try {
      server = await getX402Server()
    } catch {
      return unavailable('Payment facilitator unreachable; try again shortly')
    }
    const paymentHeader = req.headers.get('payment-signature') ?? undefined
    const context: HTTPRequestContext = { adapter: adapterFor(req, body), path: route.path, method: 'POST', paymentHeader, routePattern: `POST ${route.path}` }
    let result: Awaited<ReturnType<x402HTTPResourceServer['processHTTPRequest']>>
    try {
      result = await server.processHTTPRequest(context)
    } catch (e) {
      return unavailable(e instanceof Error ? e.message : 'verify failed')
    }

    if (result.type === 'payment-error') {
      const r = result.response
      return new NextResponse(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': r.isHtml ? 'text/html' : 'application/json', ...r.headers } })
    }
    if (result.type === 'no-payment-required') return handler(body, { receiptId: 'free' }, req)

    // One request per payment: a replayed PAYMENT-SIGNATURE never runs the handler twice.
    const { payer, hash } = inspectPayment(result.paymentPayload)
    if (hash && (await findX402ReceiptByHash(hash))) {
      await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: 409 }).catch(() => {})
      return NextResponse.json({ error: 'payment_already_used', message: 'This payment was already presented. Sign a new one.' }, { status: 409 })
    }

    const b = body as Record<string, unknown>
    const receipt = await recordX402Receipt({ endpoint: route.path, resourceId: String(b?.milestoneId ?? b?.dareId ?? b?.causeId ?? ''), payer: payer ?? null, paymentHash: hash ?? null, network: X402_NETWORK, asset: 'USDC', amount: opts.amountFor?.(body) ?? route.price, status: 'verified' }).catch(() => null)
    if (hash && !receipt) {
      // Lost the race on the unique payment hash: a concurrent request owns this payment.
      await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: 409 }).catch(() => {})
      return NextResponse.json({ error: 'payment_already_used' }, { status: 409 })
    }

    let response: NextResponse
    try {
      response = await handler(body, { payer, receiptId: receipt?.id ?? 'unknown' }, req)
    } catch (e) {
      await result.cancellationDispatcher.cancel({ reason: 'handler_threw', error: e }).catch(() => {})
      if (receipt) await updateX402Receipt(receipt.id, { status: 'failed' })
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Handler failed; payment not settled' }, { status: 500 })
    }
    if (response.status >= 400) {
      await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: response.status }).catch(() => {})
      if (receipt) await updateX402Receipt(receipt.id, { status: 'failed' })
      return response
    }

    let settle: Awaited<ReturnType<x402HTTPResourceServer['processSettlement']>>
    try {
      settle = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, { request: context }, undefined, result.beforeHandlerSettlement)
    } catch (e) {
      if (receipt) await updateX402Receipt(receipt.id, { status: 'failed' })
      return unavailable(e instanceof Error ? e.message : 'settlement failed')
    }
    if (!settle.success) {
      const pending = /pending/i.test(String(settle.errorReason ?? ''))
      if (receipt) await updateX402Receipt(receipt.id, { status: pending ? 'pending' : 'failed', paymentSignature: (settle as { transaction?: string }).transaction ?? null })
      if (pending) return NextResponse.json({ status: 'settlement_pending', receiptId: receipt?.id ?? null, message: 'The payment was broadcast and is still confirming. It will be reconciled; do not pay again.' }, { status: 202 })
      const r = settle.response
      return new NextResponse(JSON.stringify({ error: 'settlement_failed', reason: settle.errorReason, message: settle.errorMessage }), { status: r?.status ?? 402, headers: { 'Content-Type': 'application/json', ...(settle.headers ?? {}) } })
    }
    const settledPayer = settle.payer ?? payer
    if (receipt) await updateX402Receipt(receipt.id, { status: 'settled', paymentSignature: settle.transaction, payer: settledPayer ?? null })
    const headers = new Headers(response.headers)
    for (const [k, v] of Object.entries(settle.headers ?? {})) headers.set(k, v)
    headers.set('X-Umanity-Receipt', receipt?.id ?? '')
    let text = await response.text()
    if (opts.afterSettle) {
      let base: Record<string, unknown> = {}
      try {
        base = JSON.parse(text || '{}')
      } catch {
        /* non-JSON handler output */
      }
      let extra: Record<string, unknown>
      try {
        extra = await opts.afterSettle(body, { payer: settledPayer, receiptId: receipt?.id ?? 'unknown' }, { transaction: settle.transaction, payer: settledPayer, network: settle.network ?? X402_NETWORK }, base)
      } catch (e) {
        console.error('x402 afterSettle failed', e)
        extra = { recorded: false, warning: 'Payment settled but recording failed; it is reconciled from the receipt.', receiptId: receipt?.id ?? null }
      }
      text = JSON.stringify({ ...base, ...extra })
      headers.set('Content-Type', 'application/json')
    }
    return new NextResponse(text, { status: response.status, headers })
  }
}
