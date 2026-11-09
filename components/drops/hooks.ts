'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { sharedGet } from '@/lib/client/api'
import { usdcAccount } from '@/lib/umanity/usdc'
import type { DropDetail, DropView, MoneySummary } from '@/lib/umanity/data'
import { useSeed } from './seed'

/**
 * Polls a JSON endpoint while the tab is visible, starting from what the server rendered when there is
 * a seed (then the first fetch waits for the first tick). Every poller of a path shares its requests.
 */
function usePoll<T>(path: string | null, pick: (j: Record<string, unknown>) => T | null, everyMs: number, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial)
  const [loading, setLoading] = useState(initial == null)
  const [error, setError] = useState<string | null>(null)
  const seeded = useRef(initial != null)
  const load = useCallback(async (force = false) => {
    if (!path) return
    try {
      const j = await sharedGet<Record<string, unknown>>(path, 4_000, force)
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
    if (!seeded.current) load()
    seeded.current = false
    const t = setInterval(() => document.visibilityState === 'visible' && load(), everyMs)
    return () => clearInterval(t)
  }, [load, everyMs])
  const reload = useCallback(() => load(true), [load])
  return { data, loading, error, reload }
}

export function useDrops(everyMs = 15_000) {
  const seed = useSeed()
  return usePoll<DropView[]>('/api/drops', (j) => (j.drops as DropView[]) ?? [], everyMs, seed.drops ?? null)
}

export function useDrop(id: number | null, everyMs = 10_000) {
  const seed = useSeed()
  const initial = seed.drop && seed.drop.id === id ? seed.drop : null
  return usePoll<DropDetail>(id == null ? null : `/api/drops/${id}`, (j) => (j.drop as DropDetail) ?? null, everyMs, initial)
}

export function useMoney(everyMs = 20_000) {
  const seed = useSeed()
  return usePoll<MoneySummary>('/api/money', (j) => j as unknown as MoneySummary, everyMs, seed.money ?? null)
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
