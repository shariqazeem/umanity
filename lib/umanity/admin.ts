/**
 * What the team does to drops, server-side: open one, post updates and proof,
 * unlock after review, call one off, and send refunds. Admin steps are signed
 * by the authority keypair (the program's admin); refunds are permissionless
 * and paid for by the treasury, so backers never have to ask. Server-only.
 */
import { and, eq } from 'drizzle-orm'
import { type Connection, type Keypair, PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { dropGifts, drops, dropUpdates, getDb, newId } from '@/lib/db'
import type { MediaItem } from '@/lib/db/schema'
import { getAuthorityKeypair, getTreasuryKeypair } from '@/lib/solana/server-signer'
import { signAndLand } from '@/lib/solana/send'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { guardHoldsRelease, releaseDrop } from '@/lib/near/flow'
import { canonicalJson, hexToBytes, sha256Hex, validateMeta, type DropMeta } from './drops'
import { cancelDropIx, createDropIx, dropAddress, fetchBacker, fetchConfig, fetchDrop, micro, postProofIx, refundIxs, refundsOpen, unlockIxs } from './program'

async function send(conn: Connection, signer: Keypair, ixs: TransactionInstruction[]) {
  return signAndLand(conn, ixs, [signer])
}

function admin() {
  const k = getAuthorityKeypair()
  if (!k) throw new Error('The authority keypair is not set on this server')
  return k
}

export async function createDrop(conn: Connection, o: { meta: DropMeta; goalUsd: number; capUsd: number; deadline: Date; payee: string; kind?: 'official' | 'community'; proposalId?: string }) {
  const problem = validateMeta(o.meta)
  if (problem) throw new Error(problem)
  if (!(o.goalUsd >= 1) || !(o.capUsd >= o.goalUsd)) throw new Error('The cap must be at least the goal')
  const payee = new PublicKey(o.payee)
  const authority = admin()
  const config = await fetchConfig(conn)
  if (!config) throw new Error('The program is not set up on this cluster')
  if (config.admin !== authority.publicKey.toBase58()) throw new Error('This server does not hold the program admin key')
  const text = canonicalJson(o.meta)
  const metaHash = await sha256Hex(text)
  const id = config.dropCount
  const deadline = Math.floor(o.deadline.getTime() / 1000)
  const signature = await send(conn, authority, [await createDropIx(conn, { id, admin: authority.publicKey, goal: micro(o.goalUsd), cap: micro(o.capUsd), deadline, payee, metaHash: hexToBytes(metaHash) })])
  const db = await getDb()
  await db
    .insert(drops)
    .values({
      id,
      cluster: SOLANA_CLUSTER,
      address: dropAddress(id).toBase58(),
      title: o.meta.title,
      place: o.meta.place,
      story: o.meta.story,
      emoji: o.meta.emoji,
      items: o.meta.items,
      unitName: o.meta.unit.name,
      unitCents: Math.round(o.meta.unit.usd * 100),
      peoplePerUnit: o.meta.unit.people,
      meta: text,
      metaHash,
      goalMicro: Number(micro(o.goalUsd)),
      capMicro: Number(micro(o.capUsd)),
      deadline: new Date(deadline * 1000),
      payee: payee.toBase58(),
      createdTx: signature,
      kind: o.kind ?? 'official',
      proposalId: o.proposalId ?? null,
    })
    .onConflictDoNothing()
  return { id, signature, metaHash }
}

type Post = { dropId: number; title: string; body: string; media: MediaItem[]; xPostUrl?: string | null; postedBy: string }

export async function postUpdate(o: Post) {
  const db = await getDb()
  const id = newId('upd')
  await db.insert(dropUpdates).values({ id, cluster: SOLANA_CLUSTER, dropId: o.dropId, kind: 'update', title: o.title, body: o.body, media: o.media, xPostUrl: o.xPostUrl || null, postedBy: o.postedBy })
  return { id }
}

/**
 * Proof is a bundle (what was delivered, the media and their file hashes)
 * whose sha256 goes on-chain with `post_proof`. The bundle is stored as is,
 * so anyone can hash it and compare.
 */
export async function postProof(conn: Connection, o: Post) {
  const drop = await fetchDrop(conn, o.dropId)
  if (!drop) throw new Error('No such drop')
  if (drop.state !== 'open' && drop.state !== 'proven') throw new Error('This drop is already closed')
  if (o.media.length === 0 && !o.xPostUrl) throw new Error('Proof needs photos, video or the X post of the delivery')
  const bundle = canonicalJson({ v: 1, drop: o.dropId, title: o.title, body: o.body, xPostUrl: o.xPostUrl || null, media: o.media.map((m) => ({ url: m.url, kind: m.kind, sha256: m.sha256 ?? null })), at: new Date().toISOString() })
  const proofHash = await sha256Hex(bundle)
  const authority = admin()
  const signature = await send(conn, authority, [await postProofIx(conn, { dropId: o.dropId, admin: authority.publicKey, proofHash: hexToBytes(proofHash) })])
  const db = await getDb()
  const id = newId('proof')
  await db.insert(dropUpdates).values({ id, cluster: SOLANA_CLUSTER, dropId: o.dropId, kind: 'proof', title: o.title, body: o.body, media: o.media, proofHash, proofBundle: bundle, proofTx: signature, xPostUrl: o.xPostUrl || null, postedBy: o.postedBy })
  return { id, signature, proofHash }
}

/** Pays a proven drop's pot to its payee. Once the NEAR guard holds the release key, only the guard can sign this. */
export async function unlockDrop(conn: Connection, dropId: number) {
  if (await guardHoldsRelease(conn)) return releaseDrop(conn, dropId)
  const drop = await fetchDrop(conn, dropId)
  const config = await fetchConfig(conn)
  if (!drop || !config) throw new Error('No such drop')
  const signer = [getAuthorityKeypair(), getTreasuryKeypair()].find((k) => k?.publicKey.toBase58() === config.releaseAuthority)
  if (!signer) throw new Error(`Unlocking needs the release key ${config.releaseAuthority}, which this server does not hold`)
  if (!drop.proofHash) throw new Error('This drop has no proof yet')
  const proofHash = Uint8Array.from(Buffer.from(drop.proofHash, 'hex'))
  return send(conn, signer, await unlockIxs(conn, { dropId, payee: new PublicKey(drop.payee), releaseAuthority: signer.publicKey, payer: signer.publicKey, proofHash }))
}

export async function cancelDrop(conn: Connection, dropId: number) {
  const authority = admin()
  return send(conn, authority, [await cancelDropIx(conn, { dropId, admin: authority.publicKey })])
}

/**
 * Sends refunds to every backer of a drop whose refunds are open, a few per
 * transaction. Anyone may send a refund, and it can only go to the backer.
 */
export async function refundBackers(conn: Connection, dropId: number, limit = 12) {
  const drop = await fetchDrop(conn, dropId)
  if (!drop || !refundsOpen(drop)) return { sent: 0, signatures: [] as string[] }
  const payer = getTreasuryKeypair() ?? getAuthorityKeypair()
  if (!payer) throw new Error('No key on this server can pay for refunds')
  const db = await getDb()
  const rows = await db
    .selectDistinct({ backer: dropGifts.backer })
    .from(dropGifts)
    .where(and(eq(dropGifts.cluster, SOLANA_CLUSTER), eq(dropGifts.dropId, dropId), eq(dropGifts.status, 'confirmed')))
  const owed: { backer: PublicKey; rentPayer: PublicKey }[] = []
  for (const r of rows) {
    if (owed.length >= limit) break
    const rec = await fetchBacker(conn, dropId, new PublicKey(r.backer)).catch(() => null)
    if (rec && rec.amount > 0n) owed.push({ backer: new PublicKey(r.backer), rentPayer: new PublicKey(rec.rentPayer) })
  }
  const signatures: string[] = []
  for (let i = 0; i < owed.length; i += 3) {
    const ixs = (await Promise.all(owed.slice(i, i + 3).map((o) => refundIxs(conn, { dropId, backer: o.backer, rentPayer: o.rentPayer, payer: payer.publicKey })))).flat()
    signatures.push(await send(conn, payer, ixs))
  }
  return { sent: owed.length, signatures }
}
