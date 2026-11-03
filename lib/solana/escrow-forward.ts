/**
 * Moves value that reached Umanity off-program (x402 USDC payments, cross-chain
 * settlements) into a cause's on-chain escrow vault, on the same request.
 * The treasury signs `donate(amount, nonce)` into the vault PDA and attaches a
 * memo that names the original payment, so anyone can follow the money from
 * the payment to the escrow on Solscan.
 */
import { PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js'
import { getConnection } from './chain'
import { getTreasuryKeypair } from './server-signer'
import { buildDonateIx } from './instructions'

export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/** Keep this much SOL in the treasury for fees and new accounts. */
const RESERVE_LAMPORTS = 20_000_000

export interface EscrowDeposit {
  signature: string
  lamports: number
  vault: string
  forwarder: string
}

export async function depositToEscrow(poolId: string, lamports: number, memo: string): Promise<EscrowDeposit> {
  const treasury = getTreasuryKeypair()
  if (!treasury) throw new Error('Treasury signer not configured')
  if (!(lamports > 0)) throw new Error('Nothing to deposit')
  const conn = getConnection()
  const balance = await conn.getBalance(treasury.publicKey, 'confirmed')
  if (balance < lamports + RESERVE_LAMPORTS) throw new Error('Treasury float too low to forward right now')
  const { ix, vaultPda } = await buildDonateIx(conn, poolId, treasury.publicKey, lamports)
  const memoIx = new TransactionInstruction({ keys: [{ pubkey: treasury.publicKey, isSigner: true, isWritable: false }], programId: MEMO_PROGRAM, data: Buffer.from(memo.slice(0, 180), 'utf8') })
  const tx = new Transaction().add(ix, memoIx)
  const signature = await sendAndConfirmTransaction(conn, tx, [treasury], { commitment: 'confirmed' })
  return { signature, lamports, vault: vaultPda.toBase58(), forwarder: treasury.publicKey.toBase58() }
}
