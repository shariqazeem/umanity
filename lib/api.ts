import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { findUser, findUserByUsername, ensureUser } from '@/lib/data/users'
import type { User } from '@/lib/db'

export const runtime = 'nodejs'

export function ok<T extends object>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init)
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status })
}

export function isPubkey(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false
  try {
    new PublicKey(s)
    return true
  } catch {
    return false
  }
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}

/** Resolve a user from an address or username; optionally auto-create on address. */
export async function resolveUser(input: { address?: string | null; username?: string | null }, opts: { create?: boolean } = {}): Promise<User | null> {
  if (input.address && isPubkey(input.address)) {
    const u = await findUser(input.address)
    if (u) return u
    if (opts.create) return ensureUser(input.address)
    return null
  }
  if (input.username) return findUserByUsername(input.username)
  return null
}

/** Promise with a deadline; resolves to `fallback` on timeout or error. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } catch {
    return fallback
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Simple in-memory rate limiter (per process). */
const buckets = new Map<string, { n: number; reset: number }>()
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs })
    return true
  }
  if (b.n >= max) return false
  b.n += 1
  return true
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}
