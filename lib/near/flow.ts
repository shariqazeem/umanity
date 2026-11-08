/**
 * Umanity's guarded path, end to end: when proof is posted the TEE checks it
 * and the verdict goes on the NEAR guard; once the council's window and the
 * Solana review have passed, the guard has the MPC network sign the unlock.
 * Every step can be retried by anyone and is idempotent. Server-only.
 */
import { and, desc, eq } from 'drizzle-orm'
import type { Connection } from '@solana/web3.js'
import { dropUpdates, drops, getDb } from '@/lib/db'
import type { GuardRecord } from '@/lib/db/schema'
import { SOLANA_CLUSTER } from '@/lib/solana/constants'
import { getAuthorityKeypair, getTreasuryKeypair } from '@/lib/solana/server-signer'
import { dropAddress, fetchConfig, fetchDrop } from '@/lib/umanity/program'
import { GUARD_CONTRACT, NEAR_NETWORK, guardEnabled, nearExplorerAccount, nearExplorerTx } from './config'
import { checkProof } from './checker'
import { guardConfig, guardVerdict, releaseBlocker } from './guard'
import { releaseThroughGuard } from './release'

async function proofRow(dropId: number, proofHash: string) {
  const db = await getDb()
  return (
    await db
      .select()
      .from(dropUpdates)
      .where(and(eq(dropUpdates.cluster, SOLANA_CLUSTER), eq(dropUpdates.dropId, dropId), eq(dropUpdates.kind, 'proof'), eq(dropUpdates.proofHash, proofHash)))
      .orderBy(desc(dropUpdates.createdAt))
      .limit(1)
  )[0]
}

async function record(rowId: string, prev: GuardRecord | null, patch: Partial<GuardRecord>) {
  const db = await getDb()
  const next: GuardRecord = { network: NEAR_NETWORK, contract: GUARD_CONTRACT, ...(prev ?? {}), ...patch, at: new Date().toISOString() }
  await db.update(dropUpdates).set({ guard: next }).where(eq(dropUpdates.id, rowId))
  return next
}

const message = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300)

/** Has the TEE check the drop's current proof and records the verdict on the guard. */
export async function checkDropProof(conn: Connection, dropId: number) {
  const chain = await fetchDrop(conn, dropId)
  if (!chain?.proofHash) throw new Error('This drop has no proof on-chain')
  const db = await getDb()
  const row = (await db.select().from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.id, dropId))))[0]
  const proof = await proofRow(dropId, chain.proofHash)
  if (!row || !proof?.proofBundle) throw new Error('The proof bundle for the on-chain proof is not stored here')
  try {
    const out = await checkProof({ dropId, dropAccount: dropAddress(dropId).toBase58(), meta: row.meta, metaHash: row.metaHash, bundle: proof.proofBundle })
    await record(proof.id, proof.guard, { verdictTx: out.txHash ?? proof.guard?.verdictTx ?? null, registeredTx: out.registeredTx ?? proof.guard?.registeredTx ?? null, error: null })
    return out.verdict
  } catch (e) {
    await record(proof.id, proof.guard, { error: message(e) })
    throw e
  }
}

function payer() {
  const k = getTreasuryKeypair() ?? getAuthorityKeypair()
  if (!k) throw new Error('No key on this server can pay Solana fees')
  return k
}

/** True when the Solana program's release key is the guard's: unlocks must then go through the guard. */
export async function guardHoldsRelease(conn: Connection) {
  if (!guardEnabled()) return false
  const [config, guard] = await Promise.all([fetchConfig(conn), guardConfig()])
  return Boolean(config && guard.release_key && config.releaseAuthority === guard.release_key)
}

/** The guarded unlock, recorded on the proof. */
export async function releaseDrop(conn: Connection, dropId: number) {
  const chain = await fetchDrop(conn, dropId)
  const proof = chain?.proofHash ? await proofRow(dropId, chain.proofHash) : undefined
  try {
    const out = await releaseThroughGuard(conn, dropId, payer())
    if (proof) await record(proof.id, proof.guard, { releaseTx: out.nearTx, unlockTx: out.signature, error: null })
    return out.signature
  } catch (e) {
    if (proof) await record(proof.id, proof.guard, { error: message(e) })
    throw e
  }
}

/**
 * For the keeper: checks proofs that have no verdict yet, and releases drops
 * whose approval has passed both the council's window and the Solana review.
 */
export async function keepGuardMoving(conn: Connection, limit = 5) {
  if (!(await guardHoldsRelease(conn).catch(() => false))) return { checked: 0, released: 0 }
  const db = await getDb()
  const proven = await db.select({ id: drops.id }).from(drops).where(and(eq(drops.cluster, SOLANA_CLUSTER), eq(drops.state, 'proven'))).limit(limit)
  const config = await fetchConfig(conn)
  let checked = 0
  let released = 0
  for (const { id } of proven) {
    const chain = await fetchDrop(conn, id)
    if (!chain || chain.state !== 'proven' || !chain.proofHash || !config) continue
    try {
      if (!(await guardVerdict(id, chain.proofHash))) {
        await checkDropProof(conn, id)
        checked++
        continue
      }
      const solanaReviewEnds = (chain.proofAt ?? 0) + config.reviewSecs
      if (Date.now() / 1000 < solanaReviewEnds) continue
      if (await releaseBlocker(id, chain.proofHash)) continue
      await releaseDrop(conn, id)
      released++
    } catch {
      // Recorded on the proof; the next run tries again.
    }
  }
  return { checked, released }
}

/** What the drop page shows about the guard. */
export type GuardView = {
  network: 'mainnet' | 'testnet'
  contract: string
  contractUrl: string
  verdict: { approve: boolean; reason: string; model: string; at: string; reviewEndsAt: string; vetoedBy: string | null } | null
  blocker: string | null
  verdictTxUrl: string | null
  releaseTxUrl: string | null
}

/** The guard's live answer for a proof, or null when there is no guard or it does not answer in time. */
export async function guardView(dropId: number, proofHash: string | null, rec: GuardRecord | null, timeoutMs = 1500): Promise<GuardView | null> {
  if (!guardEnabled() || !proofHash) return null
  const live = Promise.all([guardVerdict(dropId, proofHash), releaseBlocker(dropId, proofHash)])
  const answer = await Promise.race([live, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]).catch(() => null)
  if (!answer) return null
  const [v, blocker] = answer
  return {
    network: NEAR_NETWORK,
    contract: GUARD_CONTRACT,
    contractUrl: nearExplorerAccount(GUARD_CONTRACT),
    verdict: v
      ? { approve: v.approve, reason: v.reason, model: v.model, at: new Date(Number(v.at_ms)).toISOString(), reviewEndsAt: new Date(Number(v.review_ends_ms)).toISOString(), vetoedBy: v.vetoed_by }
      : null,
    blocker,
    verdictTxUrl: rec?.verdictTx ? nearExplorerTx(rec.verdictTx) : null,
    releaseTxUrl: rec?.releaseTx ? nearExplorerTx(rec.releaseTx) : null,
  }
}
