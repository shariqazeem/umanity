/**
 * Finishes a program deploy that `solana program deploy` abandoned with
 * "Data writes to account failed: Max retries exceeded" (common on public
 * RPCs, which drop writes under rate limits). The SOL stays in the half-written
 * buffer; this fills it instead of paying for a new one.
 *
 *   npx tsx scripts/resume-buffer.ts <BUFFER_ADDRESS> [target/deploy/umanity_donations.so]
 *   solana program upgrade <BUFFER_ADDRESS> <PROGRAM_ID> --upgrade-authority <KEYPAIR>
 *
 * Find the buffer with `solana program show --buffers`. Only chunks that differ
 * from the local .so are rewritten, at about 3 transactions a second, and the
 * on-chain buffer is re-read after every round, so it is safe to stop and rerun.
 * Env: RPC (defaults to NEXT_PUBLIC_SOLANA_RPC, then devnet),
 * AUTHORITY_KEYPAIR_PATH (defaults to ~/.config/solana/devnet.json).
 */
import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'

const LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
const HEADER = 37 // Buffer { authority: Option<Pubkey> } = 4 + 1 + 32
const CHUNK = 960 // fits one Write plus a priority fee under the 1232-byte limit
const SENDS_PER_SEC = 3
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function retry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= 8) throw e
      const wait = Math.min(30_000, 1500 * 2 ** i)
      console.log(`  ${label} failed (${String((e as Error)?.message ?? e).slice(0, 80)}), retrying in ${wait / 1000}s`)
      await sleep(wait)
    }
  }
}

async function main() {
  const [bufferArg, soPath = 'target/deploy/umanity_donations.so'] = process.argv.slice(2)
  if (!bufferArg) throw new Error('usage: resume-buffer.ts <BUFFER_ADDRESS> [program.so]')
  const buffer = new PublicKey(bufferArg)
  const program = fs.readFileSync(soPath)
  const keyPath = process.env.AUTHORITY_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/devnet.json')
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8'))))
  const conn = new Connection(process.env.RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed')

  const diff = async (): Promise<number[]> => {
    const info = await retry('getAccountInfo', () => conn.getAccountInfo(buffer, 'confirmed'))
    if (!info) throw new Error('buffer account not found')
    if (!info.owner.equals(LOADER) || info.data.readUInt32LE(0) !== 1) throw new Error('not an upgradeable-loader buffer')
    if (info.data[4] !== 1 || !new PublicKey(info.data.subarray(5, HEADER)).equals(authority.publicKey)) throw new Error('buffer authority is not this keypair')
    if (info.data.length < HEADER + program.length) throw new Error(`buffer holds ${info.data.length - HEADER} bytes, the program needs ${program.length}`)
    const todo: number[] = []
    for (let off = 0; off < program.length; off += CHUNK) {
      const end = Math.min(off + CHUNK, program.length)
      if (!program.subarray(off, end).equals(info.data.subarray(HEADER + off, HEADER + end))) todo.push(off)
    }
    return todo
  }

  const writeIx = (offset: number) => {
    const bytes = program.subarray(offset, Math.min(offset + CHUNK, program.length))
    const data = Buffer.alloc(16 + bytes.length)
    data.writeUInt32LE(1, 0) // UpgradeableLoaderInstruction::Write { offset, bytes }
    data.writeUInt32LE(offset, 4)
    data.writeBigUInt64LE(BigInt(bytes.length), 8)
    bytes.copy(data, 16)
    return new TransactionInstruction({
      programId: LOADER,
      keys: [
        { pubkey: buffer, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    })
  }

  console.log(`${soPath}: ${program.length} bytes, ${Math.ceil(program.length / CHUNK)} chunks · ${conn.rpcEndpoint}`)
  for (let round = 1; round <= 20; round++) {
    const todo = await diff()
    console.log(`round ${round}: ${todo.length} chunks to write`)
    if (todo.length === 0) {
      console.log(`buffer complete. Next:\n  solana program upgrade ${buffer.toBase58()} <PROGRAM_ID> --upgrade-authority ${keyPath}`)
      return
    }
    let blockhash = ''
    for (const [i, off] of todo.entries()) {
      if (i % 60 === 0) blockhash = (await retry('getLatestBlockhash', () => conn.getLatestBlockhash('confirmed'))).blockhash
      const tx = new Transaction({ feePayer: authority.publicKey, recentBlockhash: blockhash })
        .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }))
        .add(writeIx(off))
      tx.sign(authority)
      await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 }).catch(async (e) => {
        if (/429/.test(String(e?.message))) await sleep(4000)
      })
      await sleep(1000 / SENDS_PER_SEC)
    }
    console.log('  sent; letting them land')
    await sleep(25_000)
  }
  throw new Error('buffer still incomplete after 20 rounds; rerun to continue')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
