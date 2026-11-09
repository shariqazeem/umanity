/**
 * GET /api/token/market?tf=1h|1d|1w: $UMANITY's price line and latest trades
 * for the Trade tab, from GeckoTerminal's public API (it indexes Meteora DBC
 * pools), cached for 30 seconds. The line runs to now with the last price, so a
 * quiet hour shows as flat, not missing. If GeckoTerminal is down, the line is the
 * pool's current price, read from the chain.
 */
import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/chain'
import { tokenSummary } from '@/lib/umanity/token'

export const dynamic = 'force-dynamic'

const GT = 'https://api.geckoterminal.com/api/v2/networks/solana/pools'
const FRAMES = {
  '1h': { path: 'minute', aggregate: 1, limit: 60, span: 3600 },
  '1d': { path: 'minute', aggregate: 15, limit: 96, span: 86_400 },
  '1w': { path: 'hour', aggregate: 4, limit: 42, span: 7 * 86_400 },
} as const
type Frame = keyof typeof FRAMES

export type MarketPoint = { t: number; p: number }
export type MarketTrade = { kind: 'buy' | 'sell'; usd: number; wallet: string; at: number; tx: string }
/** `trades` is null when the trade feed couldn't be read, so the page never shows "no trades" for an outage. */
export type Market = { points: MarketPoint[]; changePct: number | null; volume24hUsd: number | null; trades: MarketTrade[] | null; source: 'geckoterminal' | 'chain' }

async function gt<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json;version=20230302' }, next: { revalidate: 30 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const pool = process.env.UMANITY_DBC_POOL
  if (!pool) return NextResponse.json({ error: 'No token yet' }, { status: 404 })
  const tf = (new URL(req.url).searchParams.get('tf') ?? '1d') as Frame
  const f = FRAMES[tf] ?? FRAMES['1d']
  const now = Math.floor(Date.now() / 1000)

  type Ohlcv = { data?: { attributes?: { ohlcv_list?: [number, number, number, number, number, number][] } } }
  type Trades = { data?: { attributes: { kind: string; volume_in_usd: string; tx_from_address: string; block_timestamp: string; tx_hash: string } }[] }
  type Pool = { data?: { attributes?: { volume_usd?: { h24?: string }; pool_created_at?: string } } }
  const [ohlcv, trades, info] = await Promise.all([
    gt<Ohlcv>(`${GT}/${pool}/ohlcv/${f.path}?aggregate=${f.aggregate}&limit=${f.limit}&currency=usd`),
    gt<Trades>(`${GT}/${pool}/trades`),
    gt<Pool>(`${GT}/${pool}`),
  ])

  // The line starts when the window does, or when the pool was created if that is later.
  const created = info?.data?.attributes?.pool_created_at ? Math.floor(new Date(info.data.attributes.pool_created_at).getTime() / 1000) : 0
  const start = Math.max(now - f.span, created)
  const bucket = f.aggregate * (f.path === 'hour' ? 3600 : 60)
  const candles = (ohlcv?.data?.attributes?.ohlcv_list ?? []).filter((c) => c[0] + bucket > start).sort((a, b) => a[0] - b[0])
  let points: MarketPoint[] = candles.map((c) => ({ t: Math.max(c[0], start), p: c[4] }))
  let source: Market['source'] = 'geckoterminal'
  if (!points.length) {
    // Nothing traded in this window (or the API is down): the current price, flat across it.
    const price = (await tokenSummary(getConnection()).catch(() => null))?.priceUsd
    if (!price) return NextResponse.json({ error: 'No price yet' }, { status: 503 })
    points = [{ t: start, p: price }]
    source = ohlcv ? 'geckoterminal' : 'chain'
  }
  if (points[0].t > start) points.unshift({ t: start, p: candles[0]?.[1] ?? points[0].p })
  points.push({ t: now, p: points[points.length - 1].p })

  const first = points[0].p
  const last = points[points.length - 1].p
  const market: Market = {
    points,
    changePct: first > 0 ? ((last - first) / first) * 100 : null,
    volume24hUsd: info?.data?.attributes?.volume_usd?.h24 != null ? Number(info.data.attributes.volume_usd.h24) : null,
    trades: trades?.data ? trades.data.slice(0, 12).map((d) => ({
      kind: d.attributes.kind === 'sell' ? 'sell' : 'buy',
      usd: Number(d.attributes.volume_in_usd),
      wallet: d.attributes.tx_from_address,
      at: Math.floor(new Date(d.attributes.block_timestamp).getTime() / 1000),
      tx: d.attributes.tx_hash,
    })) : null,
    source,
  }
  return NextResponse.json(market, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
