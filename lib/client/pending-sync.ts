'use client'

/**
 * A gift is final the moment the transaction confirms; recording it on our
 * side can still fail (network, deploy, migration). Failed records are kept
 * here and replayed until the server acknowledges them. /api/donate/sync is
 * idempotent on the signature, so replays are safe.
 */
import { apiSend } from '@/lib/client/api'

const KEY = 'umanity.pendingSync.v1'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

export interface PendingGift {
  donor: string
  pool: string
  signature: string
  anonymous?: boolean
  dareId?: string
  at: number
}

function read(): PendingGift[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as PendingGift[]) : []
    return list.filter((p) => Date.now() - p.at < MAX_AGE_MS)
  } catch {
    return []
  }
}

function write(list: PendingGift[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function addPendingGift(p: Omit<PendingGift, 'at'>) {
  const list = read().filter((x) => x.signature !== p.signature)
  list.push({ ...p, at: Date.now() })
  write(list)
}

export function pendingGiftCount() {
  return read().length
}

/** Replays pending records; returns how many were acknowledged. */
export async function flushPendingGifts(): Promise<number> {
  const list = read()
  if (!list.length) return 0
  let done = 0
  const remaining: PendingGift[] = []
  for (const p of list) {
    try {
      const r = await apiSend<{ success: boolean; alreadyRecorded?: boolean; error?: string }>('/api/donate/sync', p, 'POST', { timeoutMs: 20_000 })
      if (r.success) done++
      else remaining.push(p)
    } catch {
      remaining.push(p)
    }
  }
  write(remaining)
  return done
}
