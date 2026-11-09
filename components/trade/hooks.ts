'use client'

import { useEffect, useState } from 'react'
import { sharedGet } from '@/lib/client/api'
import type { TokenSummary } from '@/lib/umanity/token'
import type { Market } from '@/app/api/token/market/route'

export type Timeframe = '1h' | '1d' | '1w'

/** $UMANITY from its pool, refreshed every 20 s; null until the token exists. */
export function useTokenSummary() {
  const [token, setToken] = useState<TokenSummary | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => sharedGet<{ token?: TokenSummary | null }>('/api/token', 10_000).then((d) => alive && setToken(d.token ?? null)).catch(() => {})
    load()
    const t = setInterval(load, 20_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return token
}

/** The price line and latest trades for a timeframe, refreshed every 30 s. Pass null to skip. */
export function useMarket(tf: Timeframe | null) {
  const [market, setMarket] = useState<Market | null>(null)
  useEffect(() => {
    if (!tf) return
    let alive = true
    const load = () => sharedGet<Market>(`/api/token/market?tf=${tf}`, 15_000).then((d) => alive && d?.points?.length && setMarket(d)).catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [tf])
  return market
}
