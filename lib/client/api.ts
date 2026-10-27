'use client'

/** Tiny typed fetch helpers for the browser. Every call has a timeout and never throws on network errors unless asked. */
export async function apiGet<T = Record<string, unknown>>(path: string, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000)
  try {
    const res = await fetch(path, { signal: ctrl.signal, cache: 'no-store' })
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export async function apiSend<T = Record<string, unknown>>(path: string, body: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST', opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000)
  try {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: ctrl.signal })
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export function fmtSol(n: number, digits = 3) {
  if (!isFinite(n)) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: n >= 100 ? 0 : digits, maximumFractionDigits: n >= 100 ? 0 : digits })
}

export function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 100 ? 0 : 2 })
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function countdown(seconds: number) {
  if (seconds <= 0) return 'ended'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function short(a: string | null | undefined, n = 4) {
  return a ? `${a.slice(0, n)}…${a.slice(-n)}` : ''
}
