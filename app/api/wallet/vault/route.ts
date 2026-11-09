/**
 * Sealed passkey wallets, so a synced passkey can sign in on another device.
 *   POST { credentialId, address, salt, iv, ct } → keeps the sealed copy (first write wins)
 *   GET  ?id=<credentialId>                      → the sealed copy, to open with the passkey
 * Only ciphertext is stored: opening it needs the passkey's PRF, which never leaves the device.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { clientIp, isPubkey, rateLimit } from '@/lib/api'
import { getDb, walletVaults } from '@/lib/db'

export const dynamic = 'force-dynamic'

const B64URL = /^[A-Za-z0-9_-]+$/
const ok = (s: unknown, min: number, max: number) => typeof s === 'string' && s.length >= min && s.length <= max && B64URL.test(s)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!ok(id, 16, 512)) return NextResponse.json({ error: 'Bad passkey id' }, { status: 400 })
  if (!rateLimit(`vault-get:${clientIp(req)}`, 60, 3600_000)) return NextResponse.json({ error: 'Too many tries' }, { status: 429 })
  const db = await getDb()
  const row = (await db.select().from(walletVaults).where(eq(walletVaults.credentialId, id)))[0]
  if (!row) return NextResponse.json({ error: 'No wallet for this passkey' }, { status: 404 })
  return NextResponse.json({ address: row.address, salt: row.salt, iv: row.iv, ct: row.ct })
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`vault-put:${clientIp(req)}`, 20, 3600_000)) return NextResponse.json({ error: 'Too many tries' }, { status: 429 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (!ok(b.credentialId, 16, 512) || !isPubkey(b.address as string) || !ok(b.salt, 16, 128) || !ok(b.iv, 12, 64) || !ok(b.ct, 40, 512)) {
    return NextResponse.json({ error: 'Bad vault' }, { status: 400 })
  }
  const db = await getDb()
  await db
    .insert(walletVaults)
    .values({ credentialId: b.credentialId as string, address: b.address as string, salt: b.salt as string, iv: b.iv as string, ct: b.ct as string })
    .onConflictDoNothing()
  return NextResponse.json({ ok: true })
}
