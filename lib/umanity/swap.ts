/**
 * Swaps through Jupiter (Swap V2 `/build`, Metis routing), with Umanity's fee
 * paid straight into the program's fee inbox. The inbox is a USDC account
 * owned by the program's `fees` PDA, so the fee can only leave through
 * `split_fees`: half to drops, half to Umanity. Server-only. Mainnet-only,
 * because Jupiter routes mainnet liquidity.
 */
import bs58 from 'bs58'
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  type Connection,
  type Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { USDC_MINT_MAINNET } from '@/lib/solana/constants'
import { FEE_INBOX } from './program'

/** 0.5%, below Phantom's 0.85%. Only on trades with USDC on one side, since the inbox holds USDC. */
export const SWAP_FEE_BPS = 50
/** The most the treasury may lose to one sponsored swap (network fee plus one token account's rent). */
const SPONSOR_MAX_LAMPORTS = 2_600_000

const JUP = process.env.JUPITER_API_BASE || 'https://api.jup.ag/swap/v2'
const jupHeaders = (): Record<string, string> => (process.env.JUPITER_API_KEY ? { 'x-api-key': process.env.JUPITER_API_KEY } : {})

type JupIx = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string }
type JupBuild = {
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  priceImpactPct: string
  routePlan: { swapInfo: { label?: string } }[]
  computeBudgetInstructions: JupIx[]
  setupInstructions: JupIx[]
  swapInstruction: JupIx
  cleanupInstruction: JupIx | null
  otherInstructions?: JupIx[]
  addressesByLookupTableAddress: Record<string, string[]> | null
  blockhashWithMetadata: { blockhash: number[]; lastValidBlockHeight: number }
  error?: string
}

const toIx = (i: JupIx) =>
  new TransactionInstruction({
    programId: new PublicKey(i.programId),
    keys: i.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(i.data, 'base64'),
  })

/** The fee applies when USDC is one side and the other isn't $UMANITY (whose pool fee already feeds drops). */
export function swapFeeBps(inputMint: string, outputMint: string) {
  const umanity = process.env.NEXT_PUBLIC_UMANITY_MINT
  if (umanity && (inputMint === umanity || outputMint === umanity)) return 0
  return inputMint === USDC_MINT_MAINNET || outputMint === USDC_MINT_MAINNET ? SWAP_FEE_BPS : 0
}

export type BuiltSwap = Awaited<ReturnType<typeof buildSwap>>

const ready = new Set<string>()
/** The fee inbox exists once the program is set up on this cluster; until then swaps run without the fee. */
async function accountExists(conn: Connection, account: PublicKey) {
  if (!ready.has(account.toBase58()) && (await conn.getAccountInfo(account, 'confirmed').catch(() => null))) ready.add(account.toBase58())
  return ready.has(account.toBase58())
}

export async function buildSwap(
  conn: Connection,
  o: { inputMint: string; outputMint: string; amount: string; taker: PublicKey; slippageBps: number; sponsor?: Keypair | null; feeAccount?: PublicKey }
) {
  const feeAccount = o.feeAccount ?? FEE_INBOX
  const feeBps = (await accountExists(conn, feeAccount)) ? swapFeeBps(o.inputMint, o.outputMint) : 0
  const q = new URLSearchParams({
    inputMint: o.inputMint,
    outputMint: o.outputMint,
    amount: o.amount,
    taker: o.taker.toBase58(),
    slippageBps: String(o.slippageBps),
    computeUnitPricePercentile: 'medium',
  })
  if (feeBps) {
    q.set('platformFeeBps', String(feeBps))
    q.set('feeAccount', feeAccount.toBase58())
  }
  if (o.sponsor) q.set('payer', o.sponsor.publicKey.toBase58())
  const res = await fetch(`${JUP}/build?${q}`, { headers: jupHeaders(), cache: 'no-store' })
  const j = (await res.json().catch(() => ({}))) as JupBuild
  if (!res.ok || j.error) throw new Error(j.error || `Jupiter answered ${res.status}`)

  const ixs = [...j.computeBudgetInstructions, ...j.setupInstructions, j.swapInstruction, ...(j.cleanupInstruction ? [j.cleanupInstruction] : []), ...(j.otherInstructions ?? [])].map(toIx)
  const alts = Object.entries(j.addressesByLookupTableAddress ?? {}).map(
    ([key, addresses]) =>
      new AddressLookupTableAccount({
        key: new PublicKey(key),
        state: { deactivationSlot: BigInt('18446744073709551615'), lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, addresses: addresses.map((a) => new PublicKey(a)) },
      })
  )
  const recentBlockhash = bs58.encode(Uint8Array.from(j.blockhashWithMetadata.blockhash))
  const payerKey = o.sponsor?.publicKey ?? o.taker
  const compile = (units: number) =>
    new VersionedTransaction(new TransactionMessage({ payerKey, recentBlockhash, instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...ixs] }).compileToV0Message(alts))

  // Simulate once at the cap to learn the real compute use (and, when sponsored, what it costs the treasury).
  const sponsorBefore = o.sponsor ? await conn.getBalance(o.sponsor.publicKey, 'confirmed') : 0
  const sim = await conn.simulateTransaction(compile(1_400_000), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: 'confirmed',
    accounts: o.sponsor ? { encoding: 'base64', addresses: [o.sponsor.publicKey.toBase58()] } : undefined,
  })
  if (sim.value.err) throw new Error(simulationError(sim.value.err, sim.value.logs ?? []))
  if (o.sponsor) {
    const after = sim.value.accounts?.[0]?.lamports ?? 0
    if (sponsorBefore - after > SPONSOR_MAX_LAMPORTS) throw new Error('This swap needs SOL for network fees')
  }
  const units = Math.min(1_400_000, Math.ceil((sim.value.unitsConsumed ?? 200_000) * 1.15) + 20_000)
  const tx = compile(units)
  if (o.sponsor) tx.sign([o.sponsor])

  const inAmount = BigInt(j.inAmount)
  const outAmount = BigInt(j.outAmount)
  const usdc = o.inputMint === USDC_MINT_MAINNET ? inAmount : o.outputMint === USDC_MINT_MAINNET ? outAmount : null
  return {
    tx: Buffer.from(tx.serialize()).toString('base64'),
    inAmount: j.inAmount,
    outAmount: j.outAmount,
    minOut: j.otherAmountThreshold,
    priceImpactPct: Number(j.priceImpactPct) * 100,
    route: Array.from(new Set(j.routePlan.map((r) => r.swapInfo.label).filter((l): l is string => !!l))),
    feeBps,
    /** USDC (micro) the fee comes to, when USDC is one side. */
    feeMicro: usdc == null || !feeBps ? 0 : Number((usdc * BigInt(feeBps)) / BigInt(10_000 - (o.outputMint === USDC_MINT_MAINNET ? feeBps : 0))),
    usdMicro: usdc == null ? null : Number(usdc),
    sponsored: !!o.sponsor,
    lastValidBlockHeight: j.blockhashWithMetadata.lastValidBlockHeight,
  }
}

function simulationError(err: unknown, logs: string[]) {
  console.warn('[swap] simulation failed:', JSON.stringify(err), logs.slice(-10).join('\n'))
  const text = logs.join('\n')
  if (/insufficient lamports|insufficient funds for fee|0x1\b/i.test(text) || JSON.stringify(err).includes('InsufficientFundsForFee')) return 'Not enough balance for this swap and its network fee'
  if (/slippage|0x1771/i.test(text)) return 'The price moved. Try again'
  return 'This swap would fail right now. Try a smaller amount'
}
