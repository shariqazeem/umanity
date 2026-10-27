/**
 * x402 on Solana — server side.
 *
 * Wraps a Next.js route handler so that:
 *   1. a request without PAYMENT-SIGNATURE gets HTTP 402 + PAYMENT-REQUIRED
 *      (JSON body for agents, paywall-free: we are an API, not a page);
 *   2. a request with a payment is verified with the facilitator;
 *   3. the handler runs; on 2xx the payment is settled on Solana and the
 *      PAYMENT-RESPONSE header carries the transaction signature;
 *   4. on handler failure the verified payment is cancelled (never charged).
 *
 * Facilitator: x402.org (devnet, no key) by default; PayAI / CDP for mainnet.
 * Asset: USDC (the exact-SVM scheme does not allow native SOL).
 */
import { NextRequest, NextResponse } from 'next/server'
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer, type RoutesConfig, type HTTPRequestContext, type HTTPAdapter } from '@x402/core/server'
import { ExactSvmScheme } from '@x402/svm/exact/server'
import { CAIP2_CURRENT, SOLANA_RPC, UMANITY_TREASURY, USDC_MINT } from '@/lib/solana/constants'
import { recordX402Receipt, updateX402Receipt } from '@/lib/data/intents'

export const X402_NETWORK = CAIP2_CURRENT
export const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator'
export const X402_PAY_TO = process.env.X402_PAY_TO || UMANITY_TREASURY

export const PRICES = {
  verifyMilestone: process.env.X402_PRICE_VERIFY || '0.01',
  sponsorDare: process.env.X402_PRICE_SPONSOR || '0.05',
}

export interface PaidRoute {
  path: string
  price: string
  description: string
}

export const PAID_ROUTES: Record<string, PaidRoute> = {
  verifyMilestone: { path: '/api/x402/verify-milestone', price: PRICES.verifyMilestone, description: 'AI Impact Oracle: audit a milestone delivery and get a signed attestation' },
  sponsorDare: { path: '/api/x402/sponsor-dare', price: PRICES.sponsorDare, description: 'Create a sponsored Impact Dare (agents and sponsors)' },
}

function usd(price: string) {
  return `$${price}`
}

function buildRoutes(): RoutesConfig {
  const routes: RoutesConfig = {}
  for (const r of Object.values(PAID_ROUTES)) {
    routes[`POST ${r.path}`] = {
      accepts: [{ scheme: 'exact', network: X402_NETWORK, payTo: X402_PAY_TO, price: usd(r.price), maxTimeoutSeconds: 120 }],
      description: r.description,
      mimeType: 'application/json',
      resource: `${process.env.NEXT_PUBLIC_APP_URL || 'https://umanity-solana.vercel.app'}${r.path}`,
      unpaidResponseBody: async () => ({ contentType: 'application/json', body: { error: 'Payment required', x402: { network: X402_NETWORK, asset: USDC_MINT, payTo: X402_PAY_TO, price: usd(r.price), facilitator: X402_FACILITATOR_URL, howTo: 'Retry with a PAYMENT-SIGNATURE header (x402 v2). See README → x402.' } } }),
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

export interface PaidContext {
  payer?: string
  receiptId: string
}

/**
 * Wrap a handler as an x402-paid endpoint. The handler receives the parsed
 * body and a `paid` context and returns a NextResponse; settlement happens only
 * when it returns a 2xx.
 */
export function withX402<T = Record<string, unknown>>(routeKey: keyof typeof PAID_ROUTES, handler: (body: T, paid: PaidContext, req: NextRequest) => Promise<NextResponse>) {
  const route = PAID_ROUTES[routeKey]
  return async (req: NextRequest): Promise<NextResponse> => {
    let body: T
    try {
      body = (await req.json()) as T
    } catch {
      body = {} as T
    }
    let server: x402HTTPResourceServer
    try {
      server = await getX402Server()
    } catch {
      return NextResponse.json({ error: 'Payment facilitator unavailable; try again shortly' }, { status: 503 })
    }
    // v1 fallback header name for older clients
    const paymentHeader = req.headers.get('payment-signature') ?? req.headers.get('x-payment') ?? undefined
    const context: HTTPRequestContext = { adapter: adapterFor(req, body), path: route.path, method: 'POST', paymentHeader, routePattern: `POST ${route.path}` }
    const result = await server.processHTTPRequest(context)

    if (result.type === 'payment-error') {
      const r = result.response
      return new NextResponse(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': r.isHtml ? 'text/html' : 'application/json', ...r.headers } })
    }
    if (result.type === 'no-payment-required') {
      return handler(body, { receiptId: 'free' }, req)
    }

    const payer = (result.paymentPayload as { payload?: { authorization?: { from?: string } } }).payload?.authorization?.from
    const receipt = await recordX402Receipt({ endpoint: route.path, resourceId: String((body as Record<string, unknown>)?.milestoneId ?? (body as Record<string, unknown>)?.dareId ?? ''), payer: payer ?? null, network: X402_NETWORK, asset: 'USDC', amount: route.price, status: 'verified' }).catch(() => null)

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

    const settle = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, { request: context }, undefined, result.beforeHandlerSettlement)
    if (!settle.success) {
      if (receipt) await updateX402Receipt(receipt.id, { status: 'failed' })
      const r = settle.response
      return new NextResponse(JSON.stringify({ error: 'Settlement failed', reason: settle.errorReason, message: settle.errorMessage }), { status: r?.status ?? 402, headers: { 'Content-Type': 'application/json', ...(settle.headers ?? {}) } })
    }
    if (receipt) await updateX402Receipt(receipt.id, { status: 'settled', paymentSignature: settle.transaction, payer: settle.payer ?? payer ?? null })
    const headers = new Headers(response.headers)
    for (const [k, v] of Object.entries(settle.headers ?? {})) headers.set(k, v)
    headers.set('X-Umanity-Receipt', receipt?.id ?? '')
    const text = await response.text()
    return new NextResponse(text, { status: response.status, headers })
  }
}
