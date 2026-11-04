'use client'

import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { apiGet } from '@/lib/client/api'
import { usdcAccount } from '@/lib/umanity/usdc'
import type { DropDetail, DropView, MoneySummary } from '@/lib/umanity/data'

/** Polls a JSON endpoint while the tab is visible. */
function usePoll<T>(path: string | null, pick: (j: Record<string, unknown>) => T | null, everyMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!path) return
    try {
      const j = await apiGet<Record<string, unknown>>(path)
      if (j.error) setError(String(j.error))
      else {
        setData(pick(j))
        setError(null)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), everyMs)
    return () => clearInterval(t)
  }, [load, everyMs])
  return { data, loading, error, reload: load }
}

export function useDrops(everyMs = 15_000) {
  return usePoll<DropView[]>('/api/drops', (j) => (j.drops as DropView[]) ?? [], everyMs)
}

export function useDrop(id: number | null, everyMs = 10_000) {
  return usePoll<DropDetail>(id == null ? null : `/api/drops/${id}`, (j) => (j.drop as DropDetail) ?? null, everyMs)
}

export function useMoney(everyMs = 20_000) {
  return usePoll<MoneySummary>('/api/money', (j) => j as unknown as MoneySummary, everyMs)
}

/** The open drop closest to its date, the one the Give button fills. */
export function pickNextDrop(drops: DropView[] | null) {
  return drops?.filter((d) => d.state === 'open' && !d.refundsOpen).sort((a, b) => a.deadline - b.deadline)[0] ?? null
}

/** USDC balance of an address, in dollars; null while loading. */
export function useUsdcBalance(owner: PublicKey | null) {
  const { connection } = useConnection()
  const [usd, setUsd] = useState<number | null>(null)
  const refresh = useCallback(async () => {
    if (!owner) return setUsd(null)
    const r = await connection.getTokenAccountBalance(usdcAccount(owner)).catch(() => null)
    setUsd(r ? Number(r.value.amount) / 1e6 : 0)
  }, [owner, connection])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { usd, refresh }
}
