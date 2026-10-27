'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/client/api'

export interface PlatformStats {
  totalDonations: number
  totalEscrowed: number
  totalDonors: number
  totalTransactions: number
  crossChainVolume: number
  crossChainCount: number
  discreetVolume: number
  x402Calls: number
  x402Revenue: string
  proposals: number
  activeProposals: number
  escrowAwaitingVote: number
  openDares: number
  darePot: number
  network: string
}

export function useStats(intervalMs = 60_000) {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      apiGet<{ stats?: PlatformStats }>('/api/platform/stats')
        .then((d) => alive && d.stats && setStats(d.stats))
        .catch(() => {})
    load()
    const t = setInterval(load, intervalMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [intervalMs])
  return stats
}

/** Counts down from `seconds`, re-synced whenever the input changes. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [seconds])
  return left
}

/** Fetches JSON once (and again when `key` changes). */
export function useApi<T>(path: string | null, key?: unknown) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let alive = true
    setLoading(true)
    apiGet<T & { success?: boolean; error?: string }>(path)
      .then((d) => {
        if (!alive) return
        if (d && (d as { success?: boolean }).success === false) setError((d as { error?: string }).error || 'Request failed')
        else setData(d)
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick])
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData }
}
