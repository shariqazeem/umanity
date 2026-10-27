'use client'

/** Builds the signed headers admin endpoints require (see lib/contracts.ts). */
import bs58 from 'bs58'
import type { Signer } from '@/components/providers/UmanityProvider'
import { ADMIN_MESSAGE_PREFIX } from '@/lib/contracts'

export async function adminHeaders(signer: Signer): Promise<Record<string, string>> {
  if (!signer.signMessage) throw new Error('This wallet cannot sign messages')
  const message = `${ADMIN_MESSAGE_PREFIX}${Math.floor(Date.now() / 1000)}`
  const sig = await signer.signMessage(new TextEncoder().encode(message))
  return {
    'x-umanity-address': signer.publicKey.toBase58(),
    'x-umanity-message': message,
    'x-umanity-signature': bs58.encode(sig),
  }
}

export async function adminFetch<T = Record<string, unknown>>(signer: Signer, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers = await adminHeaders(signer)
  const res = await fetch(path, {
    method: init.method ?? 'POST',
    headers: init.form ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  })
  return (await res.json()) as T
}
