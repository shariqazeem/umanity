'use client'

import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { buildDonateIx, buildCreateDareIx, buildBoostDareIx, buildOneTapIx } from '@/lib/solana/instructions'
import type { Signer } from '@/components/providers/UmanityProvider'

async function sendSigned(connection: Connection, signer: Signer, tx: Transaction, extraSigners: Keypair[] = []): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = signer.publicKey
  for (const k of extraSigners) tx.partialSign(k)
  const signed = await signer.signTransaction(tx)
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 })
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  return sig
}

/** Donate SOL to a cause vault using the v2 PDA-record instruction. */
export async function donateSol(connection: Connection, signer: Signer, poolId: string, sol: number): Promise<string> {
  const lamports = Math.round(sol * LAMPORTS_PER_SOL)
  const { ix } = await buildDonateIx(connection, poolId, signer.publicKey, lamports)
  return sendSigned(connection, signer, new Transaction().add(ix))
}

/** Classic one-tap 0.01 SOL (v1 instruction with a keypair record). */
export async function oneTapDonate(connection: Connection, signer: Signer, poolId: string): Promise<string> {
  const record = Keypair.generate()
  const ix = await buildOneTapIx(poolId, signer.publicKey, record.publicKey)
  return sendSigned(connection, signer, new Transaction().add(ix), [record])
}

export async function createDareOnChain(connection: Connection, signer: Signer, input: { poolId: string; targetHandle: string; text: string; stakeSol: number; hours: number; targetWallet?: string | null }) {
  const { ix, darePda, nonce } = await buildCreateDareIx(input.poolId, signer.publicKey, {
    targetHandle: input.targetHandle,
    text: input.text,
    stakeLamports: Math.round(input.stakeSol * LAMPORTS_PER_SOL),
    durationSecs: Math.round(input.hours * 3600),
    targetWallet: input.targetWallet ? new PublicKey(input.targetWallet) : null,
  })
  const signature = await sendSigned(connection, signer, new Transaction().add(ix))
  return { signature, darePda: darePda.toBase58(), nonce: nonce.toString() }
}

export async function boostDareOnChain(connection: Connection, signer: Signer, darePda: string, sol: number): Promise<string> {
  const ix = await buildBoostDareIx(new PublicKey(darePda), signer.publicKey, Math.round(sol * LAMPORTS_PER_SOL))
  return sendSigned(connection, signer, new Transaction().add(ix))
}
