/**
 * Umanity program v3 client: addresses, reads and instruction builders.
 * Works in the browser and on the server (no Node-only imports).
 *
 * Money is USDC with 6 decimals. Amounts here are micro-USDC (`bigint` or
 * BN); use `usd()` / `micro()` at the edges.
 */
import { BN, EventParser, Program, type IdlEvents } from '@coral-xyz/anchor'
import { Connection, PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token'
import idl from '@/lib/idl/umanity.json'
import type { Umanity } from '@/lib/idl/umanity'
import { USDC, usdcAccount } from './usdc'

export const UMANITY_PROGRAM_ID = new PublicKey(idl.address)
export { USDC, usdcAccount }
export const METEORA_DBC = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN')
export const METEORA_DBC_POOL_AUTHORITY = new PublicKey('FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM')

export const DROP_STATE = ['open', 'proven', 'unlocked', 'cancelled'] as const
export type DropState = (typeof DROP_STATE)[number]
/** Matches UNLOCK_GRACE_SECS in the program. */
export const UNLOCK_GRACE_SECS = 7 * 24 * 60 * 60

// ---------- Amounts ----------

export const micro = (usdAmount: number) => BigInt(Math.round(usdAmount * 1_000_000))
export const usd = (microAmount: bigint | number | BN) => Number(microAmount.toString()) / 1_000_000

// ---------- Addresses ----------

const seed = (s: string) => new TextEncoder().encode(s)
const u64le = (n: number | bigint) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true)
  return b
}
const find = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, UMANITY_PROGRAM_ID)[0]

export const CONFIG = find(seed('config'))
/** Owns the fee inbox and is the fee claimer of the $UMANITY Meteora config. */
export const FEES = find(seed('fees'))
export const dropAddress = (id: number) => find(seed('drop'), u64le(id))
export const backerAddress = (drop: PublicKey, backer: PublicKey) => find(seed('backer'), drop.toBytes(), backer.toBytes())
/** Each drop's pot is the drop address's USDC account. */
export const potAddress = (id: number) => usdcAccount(dropAddress(id))
export const FEE_INBOX = usdcAccount(FEES)
export const DROPS_FUND = usdcAccount(CONFIG)

// ---------- Program handle ----------

const programs = new WeakMap<Connection, Program<Umanity>>()
/** Read-only handle; instruction builders below never need a wallet. */
export function umanityProgram(connection: Connection): Program<Umanity> {
  let p = programs.get(connection)
  if (!p) {
    p = new Program<Umanity>(idl as Umanity, { connection })
    programs.set(connection, p)
  }
  return p
}

// ---------- Reads ----------

export type ChainDrop = {
  id: number
  address: string
  pot: string
  payee: string
  goal: bigint
  cap: bigint
  deadline: number
  createdAt: number
  metaHash: string
  state: DropState
  given: bigint
  fromFund: bigint
  refunded: bigint
  returned: bigint
  backers: number
  gifts: number
  proofHash: string | null
  proofAt: number | null
  unlocked: bigint
  unlockedAt: number | null
  cancelledAt: number | null
}

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
const big = (b: BN) => BigInt(b.toString())
const ts = (b: BN) => (b.isZero() ? null : b.toNumber())

type RawDrop = Awaited<ReturnType<Program<Umanity>['account']['drop']['fetch']>>

function toDrop(address: PublicKey, d: RawDrop): ChainDrop {
  const id = d.id.toNumber()
  const proof = hex(d.proofHash)
  return {
    id,
    address: address.toBase58(),
    pot: potAddress(id).toBase58(),
    payee: d.payee.toBase58(),
    goal: big(d.goal),
    cap: big(d.cap),
    deadline: d.deadline.toNumber(),
    createdAt: d.createdAt.toNumber(),
    metaHash: hex(d.metaHash),
    state: DROP_STATE[d.state] ?? 'open',
    given: big(d.given),
    fromFund: big(d.fromFund),
    refunded: big(d.refunded),
    returned: big(d.returned),
    backers: d.backers,
    gifts: d.gifts,
    proofHash: /^0+$/.test(proof) ? null : proof,
    proofAt: ts(d.proofAt),
    unlocked: big(d.unlocked),
    unlockedAt: ts(d.unlockedAt),
    cancelledAt: ts(d.cancelledAt),
  }
}

export async function fetchConfig(connection: Connection) {
  const c = await umanityProgram(connection).account.config.fetchNullable(CONFIG)
  if (!c) return null
  return {
    admin: c.admin.toBase58(),
    releaseAuthority: c.releaseAuthority.toBase58(),
    releaseLocked: c.releaseLocked,
    ops: c.ops.toBase58(),
    usdcMint: c.usdcMint.toBase58(),
    maxPot: big(c.maxPot),
    reviewSecs: c.reviewSecs.toNumber(),
    dropCount: c.dropCount.toNumber(),
    feesSplit: big(c.feesSplit),
    fundIn: big(c.fundIn),
    fundOut: big(c.fundOut),
    fundBack: big(c.fundBack),
    opsOut: big(c.opsOut),
  }
}
export type ChainConfig = NonNullable<Awaited<ReturnType<typeof fetchConfig>>>

export async function fetchDrop(connection: Connection, id: number): Promise<ChainDrop | null> {
  const address = dropAddress(id)
  const d = await umanityProgram(connection).account.drop.fetchNullable(address)
  return d ? toDrop(address, d) : null
}

export async function fetchDrops(connection: Connection): Promise<ChainDrop[]> {
  const all = await umanityProgram(connection).account.drop.all()
  return all.map((a) => toDrop(a.publicKey, a.account)).sort((a, b) => a.id - b.id)
}

export async function fetchBacker(connection: Connection, dropId: number, backer: PublicKey) {
  const r = await umanityProgram(connection).account.backer.fetchNullable(backerAddress(dropAddress(dropId), backer))
  return r ? { amount: big(r.amount), gifts: r.gifts, rentPayer: r.rentPayer.toBase58() } : null
}

/** USDC balance of a token account in micro-USDC; 0 when it doesn't exist. */
export async function tokenBalance(connection: Connection, account: PublicKey): Promise<bigint> {
  const r = await connection.getTokenAccountBalance(account).catch(() => null)
  return r ? BigInt(r.value.amount) : 0n
}

/** Refunds open when a drop is cancelled, misses its date unproven, or isn't unlocked in the grace period. */
export function refundsOpen(d: Pick<ChainDrop, 'state' | 'deadline'>, nowSecs = Math.floor(Date.now() / 1000)) {
  if (d.state === 'cancelled') return true
  if (d.state === 'open') return nowSecs > d.deadline
  if (d.state === 'proven') return nowSecs > d.deadline + UNLOCK_GRACE_SECS
  return false
}

// ---------- Events ----------

export type UmanityEvent = { [K in keyof IdlEvents<Umanity>]: { name: K; data: IdlEvents<Umanity>[K] } }[keyof IdlEvents<Umanity>]

let parser: EventParser | null = null

/**
 * Decodes the program's events from a transaction's log messages. Names and
 * fields come out camelCase (`gave`, `giftRef`), like the generated types,
 * because the coder is taken from a Program, which camel-cases the IDL.
 */
export function parseEvents(logs: string[]): UmanityEvent[] {
  parser ??= new EventParser(UMANITY_PROGRAM_ID, new Program<Umanity>(idl as Umanity, { connection: new Connection('http://127.0.0.1') }).coder)
  return [...parser.parseLogs(logs)] as UmanityEvent[]
}

// ---------- Instructions ----------

const ref16 = (ref: Uint8Array) => {
  if (ref.length !== 16) throw new Error('gift ref must be 16 bytes')
  return Array.from(ref)
}

/** A gift from `giver`'s USDC. `backer` gets any refund; `payer` covers the record's rent. */
export async function giveIx(
  connection: Connection,
  a: { dropId: number; giver: PublicKey; amount: bigint; ref: Uint8Array; backer?: PublicKey; payer?: PublicKey },
): Promise<TransactionInstruction> {
  const drop = dropAddress(a.dropId)
  const backer = a.backer ?? a.giver
  return umanityProgram(connection)
    .methods.give(new BN(a.amount.toString()), backer, ref16(a.ref))
    .accountsPartial({
      config: CONFIG,
      drop,
      pot: usdcAccount(drop),
      backerRecord: backerAddress(drop, backer),
      source: usdcAccount(a.giver),
      giver: a.giver,
      payer: a.payer ?? a.giver,
      usdcMint: USDC,
    })
    .instruction()
}

export async function openBackerIx(connection: Connection, a: { dropId: number; backer: PublicKey; payer: PublicKey }) {
  const drop = dropAddress(a.dropId)
  return umanityProgram(connection)
    .methods.openBacker(a.backer)
    .accountsPartial({ drop, backerRecord: backerAddress(drop, a.backer), payer: a.payer })
    .instruction()
}

/** Everything `giver` holds above `keep`, for execute-on-arrival intents. The backer record must exist. */
export async function giveAllIx(connection: Connection, a: { dropId: number; giver: PublicKey; backer: PublicKey; keep?: bigint; ref: Uint8Array }) {
  const drop = dropAddress(a.dropId)
  return umanityProgram(connection)
    .methods.giveAll(new BN((a.keep ?? 0n).toString()), ref16(a.ref))
    .accountsPartial({
      config: CONFIG,
      drop,
      pot: usdcAccount(drop),
      backerRecord: backerAddress(drop, a.backer),
      source: usdcAccount(a.giver),
      giver: a.giver,
      usdcMint: USDC,
    })
    .instruction()
}

/** Anyone can send a refund; it can only go to the backer. Creates their USDC account if needed. */
export async function refundIxs(connection: Connection, a: { dropId: number; backer: PublicKey; rentPayer: PublicKey; payer: PublicKey }) {
  const drop = dropAddress(a.dropId)
  const ix = await umanityProgram(connection)
    .methods.refund()
    .accountsPartial({
      config: CONFIG,
      drop,
      pot: usdcAccount(drop),
      backerRecord: backerAddress(drop, a.backer),
      backer: a.backer,
      backerUsdc: usdcAccount(a.backer),
      rentPayer: a.rentPayer,
      usdcMint: USDC,
    })
    .instruction()
  return [createAssociatedTokenAccountIdempotentInstruction(a.payer, usdcAccount(a.backer), a.backer, USDC), ix]
}

export async function unlockIxs(connection: Connection, a: { dropId: number; payee: PublicKey; releaseAuthority: PublicKey; payer: PublicKey }) {
  const drop = dropAddress(a.dropId)
  const ix = await umanityProgram(connection)
    .methods.unlock()
    .accountsPartial({
      config: CONFIG,
      drop,
      pot: usdcAccount(drop),
      payee: a.payee,
      payeeUsdc: usdcAccount(a.payee),
      releaseAuthority: a.releaseAuthority,
      usdcMint: USDC,
    })
    .instruction()
  return [createAssociatedTokenAccountIdempotentInstruction(a.payer, usdcAccount(a.payee), a.payee, USDC), ix]
}

export async function postProofIx(connection: Connection, a: { dropId: number; admin: PublicKey; proofHash: Uint8Array }) {
  return umanityProgram(connection)
    .methods.postProof(Array.from(a.proofHash))
    .accountsPartial({ config: CONFIG, drop: dropAddress(a.dropId), admin: a.admin })
    .instruction()
}

export async function cancelDropIx(connection: Connection, a: { dropId: number; admin: PublicKey }) {
  return umanityProgram(connection)
    .methods.cancelDrop()
    .accountsPartial({ config: CONFIG, drop: dropAddress(a.dropId), admin: a.admin })
    .instruction()
}

export async function createDropIx(
  connection: Connection,
  a: { id: number; admin: PublicKey; goal: bigint; cap: bigint; deadline: number; payee: PublicKey; metaHash: Uint8Array },
) {
  const drop = dropAddress(a.id)
  return umanityProgram(connection)
    .methods.createDrop(new BN(a.goal.toString()), new BN(a.cap.toString()), new BN(a.deadline), a.payee, Array.from(a.metaHash))
    .accountsPartial({ config: CONFIG, drop, pot: usdcAccount(drop), usdcMint: USDC, admin: a.admin })
    .instruction()
}

export async function fundDropIx(connection: Connection, a: { dropId: number; admin: PublicKey; amount: bigint }) {
  const drop = dropAddress(a.dropId)
  return umanityProgram(connection)
    .methods.fundDrop(new BN(a.amount.toString()))
    .accountsPartial({ config: CONFIG, drop, pot: usdcAccount(drop), dropsFund: DROPS_FUND, admin: a.admin, usdcMint: USDC })
    .instruction()
}

export async function returnToFundIx(connection: Connection, a: { dropId: number }) {
  const drop = dropAddress(a.dropId)
  return umanityProgram(connection)
    .methods.returnToFund()
    .accountsPartial({ config: CONFIG, drop, pot: usdcAccount(drop), dropsFund: DROPS_FUND, usdcMint: USDC })
    .instruction()
}

export async function splitFeesIxs(connection: Connection, a: { ops: PublicKey; payer: PublicKey }) {
  const ix = await umanityProgram(connection)
    .methods.splitFees()
    .accountsPartial({ config: CONFIG, fees: FEES, feeInbox: FEE_INBOX, dropsFund: DROPS_FUND, ops: a.ops, opsUsdc: usdcAccount(a.ops), usdcMint: USDC })
    .instruction()
  return [createAssociatedTokenAccountIdempotentInstruction(a.payer, usdcAccount(a.ops), a.ops, USDC), ix]
}

/** Claims $UMANITY trading fees from Meteora into the inbox and splits them. Anyone can send it. */
export async function sweepMeteoraFeesIxs(
  connection: Connection,
  a: { ops: PublicKey; payer: PublicKey; dbcConfig: PublicKey; pool: PublicKey; baseMint: PublicKey; baseVault: PublicKey; quoteVault: PublicKey },
) {
  const ix = await umanityProgram(connection)
    .methods.sweepMeteoraFees(new BN(0), new BN('18446744073709551615'))
    .accountsPartial({
      config: CONFIG,
      fees: FEES,
      feeInbox: FEE_INBOX,
      feesBase: usdcAccount(FEES, a.baseMint),
      dropsFund: DROPS_FUND,
      ops: a.ops,
      opsUsdc: usdcAccount(a.ops),
      dbcConfig: a.dbcConfig,
      dbcPool: a.pool,
      baseVault: a.baseVault,
      quoteVault: a.quoteVault,
      baseMint: a.baseMint,
      dbcPoolAuthority: METEORA_DBC_POOL_AUTHORITY,
      dbcProgram: METEORA_DBC,
      usdcMint: USDC,
    })
    .instruction()
  return [
    createAssociatedTokenAccountIdempotentInstruction(a.payer, usdcAccount(FEES, a.baseMint), FEES, a.baseMint),
    createAssociatedTokenAccountIdempotentInstruction(a.payer, usdcAccount(a.ops), a.ops, USDC),
    ix,
  ]
}
