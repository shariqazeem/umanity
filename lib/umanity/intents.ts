/**
 * Gifts into a drop from any chain, through Aurora Intents (the 1Click Swap API
 * on NEAR Intents). The giver picks an asset on one of 30+ chains and sends it
 * to a one-off deposit address. The solver delivers exactly the asked USDC to
 * Umanity's treasury on Solana, and the treasury `give`s it into the drop's pot
 * with the giver's Umanity wallet as the backer, so a missed date refunds them
 * like any other gift. If the pot filled or closed while the swap ran, whatever
 * no longer fits goes to the backer's own USDC account in the same transaction.
 * A failed swap is refunded on the origin chain by NEAR Intents.
 *
 * Mainnet only: NEAR Intents has no testnet, so on devnet quotes are previews.
 * Server-only.
 */
import { createHash } from 'crypto'
import bs58 from 'bs58'
import { ComputeBudgetProgram, type Connection, PublicKey, Transaction } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from '@solana/spl-token'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { dropGifts, getDb, intents, type Intent } from '@/lib/db'
import { CHAIN_LABELS, deadlineMinutesFor, getQuote, getStatus, getTokens, INTEGRATOR_FEE_BPS, SOLANA_DEST_ASSETS, type StatusResponse } from '@/lib/intents/oneclick'
import { claimIntentSuccess, createIntentRecord, getIntent, updateIntent } from '@/lib/data/intents'
import { ensureUser } from '@/lib/data/users'
import { getTreasuryKeypair } from '@/lib/solana/server-signer'
import { IS_MAINNET, SOLANA_CLUSTER } from '@/lib/solana/constants'
import { fetchDrop, giveIx, tokenBalance } from './program'
import { USDC, usdcAccount } from './usdc'

/** How intent states read to us. FAILED is retried by the network, so it isn't final. */
const STATUS_MAP: Record<string, string> = {
  PENDING_DEPOSIT: 'pending_deposit',
  KNOWN_DEPOSIT_TX: 'processing',
  INCOMPLETE_DEPOSIT: 'incomplete_deposit',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  REFUNDED: 'refunded',
  FAILED: 'failed',
}
const OPEN_STATES = new Set(['pending_deposit', 'incomplete_deposit', 'processing', 'failed'])

const EVM_CHAINS = new Set(['eth', 'base', 'arb', 'op', 'pol', 'bsc', 'avax', 'gnosis', 'bera', 'monad', 'aurora', 'plasma', 'scroll', 'xlayer', 'adi'])
const BTC_LIKE: Record<string, string> = {
  btc: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  ltc: 'ltc1qd4r4vk7qf7q6v7vz2n4d2dxv8h5c0cgtl8w2kz',
  doge: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
  bch: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
}

/** A valid-looking refund address, used only for previews; live quotes always use the giver's own. */
function previewRefundAddress(chain: string, solana: string): string | null {
  if (chain === 'sol') return solana
  if (EVM_CHAINS.has(chain)) return '0x1111111111111111111111111111111111111111'
  if (BTC_LIKE[chain]) return BTC_LIKE[chain]
  if (chain === 'near') return 'intents.near'
  return null
}

const TREASURY_ADDRESS = () => getTreasuryKeypair()?.publicKey.toBase58() ?? process.env.NEXT_PUBLIC_UMANITY_TREASURY ?? ''

export type DropQuote = {
  live: boolean
  intentId: string | null
  depositAddress: string | null
  depositMemo: string | null
  /** What to send, in the origin asset. */
  amountIn: string
  amountInFormatted: string
  amountInUsd: string | null
  /** What lands in the pot. */
  amountUsd: number
  deadline: string | null
  timeEstimate: number | null
  asset: { id: string; symbol: string; chain: string; chainLabel: string }
  feeBps: number
}

/** Room left in a pot, in USDC micro (the program caps the pot's balance, not what was given). */
async function roomMicro(conn: Connection, dropId: number) {
  const drop = await fetchDrop(conn, dropId)
  if (!drop || drop.state !== 'open' || Date.now() / 1000 >= drop.deadline) return { drop, room: 0n }
  const pot = await tokenBalance(conn, new PublicKey(drop.pot))
  return { drop, room: drop.cap > pot ? drop.cap - pot : 0n }
}

/**
 * Prices a gift of `amountUsd` from `originAsset`. With `live` (mainnet only) it
 * also opens a deposit address and records the intent, so the status route and
 * the keeper can carry it into the pot.
 */
export async function quoteDropGift(conn: Connection, o: { dropId: number; originAsset: string; amountUsd: number; live: boolean; refundTo?: string; backer?: string }): Promise<DropQuote> {
  if (!(o.amountUsd >= 1)) throw new Error('The smallest gift is $1')
  const token = (await getTokens()).find((t) => t.assetId === o.originAsset)
  if (!token) throw new Error('That asset is not supported')
  const micro = BigInt(Math.round(o.amountUsd * 100) * 10_000)

  const { drop, room } = await roomMicro(conn, o.dropId)
  if (!drop) throw new Error('No such drop')
  if (room === 0n) throw new Error('This drop is not taking gifts')
  // A slow chain can take a while to confirm; the gift must still land before the drop closes.
  const minutes = deadlineMinutesFor(token.blockchain)
  if (Date.now() / 1000 + (minutes + 30) * 60 > drop.deadline) throw new Error('This drop closes too soon for a cross-chain gift')
  if (micro > room) throw new Error(`This pot has room for $${(Number(room) / 1e6).toFixed(2)} more`)

  const live = o.live && IS_MAINNET
  const treasury = TREASURY_ADDRESS()
  if (!treasury) throw new Error('Cross-chain gifts are not set up on this server')
  if (live) {
    if (!getTreasuryKeypair()) throw new Error('Cross-chain gifts are not set up on this server')
    if (!o.backer) throw new Error('Sign in first, so the gift (and any refund) is yours')
    if (!o.refundTo?.trim()) throw new Error(`Enter your ${CHAIN_LABELS[token.blockchain]?.label ?? token.blockchain} address, for a refund if the swap fails`)
  }
  const refundTo = live ? o.refundTo!.trim() : previewRefundAddress(token.blockchain, o.backer || treasury)
  if (!refundTo) throw new Error(`Enter your ${CHAIN_LABELS[token.blockchain]?.label ?? token.blockchain} address to see a price`)

  const q = await getQuote({
    originAsset: token.assetId,
    destinationAsset: SOLANA_DEST_ASSETS.USDC,
    amount: micro.toString(),
    swapType: 'EXACT_OUTPUT',
    recipient: treasury,
    refundTo,
    dry: !live,
    deadlineMinutes: minutes,
    referral: 'umanity',
  })

  let intentId: string | null = null
  if (live) {
    if (!q.quote.depositAddress) throw new Error('No deposit address came back; try again')
    await ensureUser(o.backer!)
    const row = await createIntentRecord({
      userAddress: o.backer!,
      dropId: o.dropId,
      status: 'pending_deposit',
      sourceChain: token.blockchain,
      sourceAsset: token.symbol,
      sourceAmount: q.quote.amountInFormatted,
      destAsset: 'USDC',
      destAddress: treasury,
      depositAddress: q.quote.depositAddress,
      depositMemo: q.quote.depositMemo ?? null,
      quote: q as unknown as Record<string, unknown>,
      integratorFeeBps: INTEGRATOR_FEE_BPS,
      targetMicro: Number(micro),
    })
    intentId = row.id
  }
  return {
    live,
    intentId,
    depositAddress: q.quote.depositAddress ?? null,
    depositMemo: q.quote.depositMemo ?? null,
    amountIn: q.quote.amountIn,
    amountInFormatted: q.quote.amountInFormatted,
    amountInUsd: q.quote.amountInUsd ?? null,
    amountUsd: Number(micro) / 1e6,
    deadline: q.quote.deadline ?? null,
    timeEstimate: q.quote.timeEstimate ?? null,
    asset: { id: token.assetId, symbol: token.symbol, chain: token.blockchain, chainLabel: CHAIN_LABELS[token.blockchain]?.label ?? token.blockchain },
    feeBps: INTEGRATOR_FEE_BPS,
  }
}

export type DropIntentView = {
  id: string
  dropId: number
  status: string
  asset: string
  chain: string
  sourceAmount: string | null
  depositAddress: string | null
  depositMemo: string | null
  targetUsd: number
  receivedUsd: number | null
  intoPotUsd: number | null
  returnedUsd: number | null
  settled: boolean
  /** The Solana transaction that put it in the pot (and returned any overflow). */
  signature: string | null
  /** The solver's delivery to the treasury. */
  deliverySignature: string | null
  refund: { amount: string | null; reason: string | null } | null
  shortfall: { received: string | null; expected: string | null } | null
}

export function intentView(i: Intent): DropIntentView {
  const s = i.lastStatusPayload as StatusResponse | null
  const received = i.receivedMicro ?? null
  const returned = i.returnedMicro ?? null
  return {
    id: i.id,
    dropId: i.dropId ?? -1,
    status: i.settledAt ? 'in_pot' : i.status,
    asset: i.sourceAsset,
    chain: CHAIN_LABELS[i.sourceChain]?.label ?? i.sourceChain,
    sourceAmount: i.sourceAmount,
    depositAddress: i.depositAddress,
    depositMemo: i.depositMemo,
    targetUsd: (i.targetMicro ?? 0) / 1e6,
    receivedUsd: received != null ? received / 1e6 : null,
    intoPotUsd: i.settledAt && received != null ? (received - (returned ?? 0)) / 1e6 : null,
    returnedUsd: returned != null && returned > 0 ? returned / 1e6 : null,
    settled: !!i.settledAt,
    signature: i.settledAt ? i.giveSignature : null,
    deliverySignature: i.settlementSignature,
    refund: s?.status === 'REFUNDED' ? { amount: s.swapDetails?.refundedAmountFormatted ?? null, reason: s.swapDetails?.refundReason ?? null } : null,
    shortfall: s?.status === 'INCOMPLETE_DEPOSIT' ? { received: s.swapDetails?.amountInFormatted ?? null, expected: s.quoteResponse?.quote?.amountInFormatted ?? null } : null,
  }
}

/** Polls NEAR Intents for a drop gift and, once delivered, settles it into the pot. Safe to call from many places at once. */
export async function refreshDropIntent(conn: Connection, id: string): Promise<{ intent: Intent; error?: string } | null> {
  let intent = await getIntent(id)
  if (!intent || intent.dropId == null) return null
  if (intent.settledAt) return { intent }

  if (intent.status !== 'success') {
    if (!intent.depositAddress || !OPEN_STATES.has(intent.status)) return { intent }
    let s: StatusResponse
    try {
      s = await getStatus(intent.depositAddress, intent.depositMemo ?? undefined)
    } catch (e) {
      return { intent, error: (e as Error).message }
    }
    const mapped = STATUS_MAP[s.status] ?? intent.status
    const dest = s.swapDetails?.destinationChainTxHashes?.[0]
    const out = s.swapDetails?.amountOut
    // 'success' is only written by claimIntentSuccess, so two pollers can't both move on to settling.
    intent =
      (await updateIntent(id, {
        ...(mapped === 'success' ? {} : { status: mapped }),
        lastStatusPayload: s as unknown as Record<string, unknown>,
        ...(dest?.hash ? { settlementSignature: dest.hash, explorerUrl: dest.explorerUrl ?? null } : {}),
        ...(out && /^\d+$/.test(out) ? { receivedMicro: Number(out) } : {}),
      })) ?? intent
    if (mapped !== 'success') return { intent }
    const claimed = await claimIntentSuccess(id)
    if (!claimed) return { intent: (await getIntent(id)) ?? intent }
    intent = claimed
  }
  return settle(conn, intent)
}

/**
 * Puts delivered USDC into the pot (and any overflow back to the backer) in
 * one transaction signed by the treasury. The signature is stored before the
 * transaction is sent, so a retry first checks whether it landed instead of
 * paying twice.
 */
async function settle(conn: Connection, intent: Intent): Promise<{ intent: Intent; error?: string }> {
  const treasury = getTreasuryKeypair()
  if (!treasury) return { intent, error: 'The treasury key is not set on this server' }
  const db = await getDb()

  if (intent.giveSignature) {
    const st = (await conn.getSignatureStatuses([intent.giveSignature], { searchTransactionHistory: true })).value[0]
    if (st && !st.err && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return finish(intent, intent.giveSignature)
    if (!st && (await conn.getBlockHeight('confirmed')) <= (intent.giveValidUntil ?? 0)) return { intent }
    // It failed or expired: build it again from the current state of the pot.
    intent = (await updateIntent(intent.id, { giveSignature: null, giveValidUntil: null })) ?? intent
  }

  // One settler at a time: whoever sets the ref sends the transaction.
  if (!intent.giveRef) {
    const ref = createHash('sha256').update(`umanity:intent:${intent.id}`).digest().subarray(0, 16).toString('hex')
    const won = await db.update(intents).set({ giveRef: ref, updatedAt: new Date() }).where(and(eq(intents.id, intent.id), isNull(intents.giveRef))).returning()
    if (!won.length) return { intent: (await getIntent(intent.id)) ?? intent }
    intent = won[0]
  }

  const received = BigInt(intent.receivedMicro ?? 0)
  if (received <= 0n) return { intent, error: 'The delivered amount is unknown' }
  const backer = new PublicKey(intent.userAddress!)
  const { room } = await roomMicro(conn, intent.dropId!)
  const toPot = received < room ? received : room
  const back = received - toPot

  const tx = new Transaction()
  if (IS_MAINNET) tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }))
  const ref = Buffer.from(intent.giveRef!, 'hex')
  if (toPot > 0n) tx.add(await giveIx(conn, { dropId: intent.dropId!, giver: treasury.publicKey, amount: toPot, ref, backer, payer: treasury.publicKey }))
  if (back > 0n) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, usdcAccount(backer), backer, USDC),
      createTransferCheckedInstruction(usdcAccount(treasury.publicKey), USDC, usdcAccount(backer), treasury.publicKey, back, 6),
    )
  }
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = treasury.publicKey
  tx.sign(treasury)
  const signature = bs58.encode(tx.signature!)

  if (toPot > 0n) {
    const chain = CHAIN_LABELS[intent.sourceChain]?.label ?? intent.sourceChain
    await db
      .insert(dropGifts)
      .values({
        ref: intent.giveRef!,
        cluster: SOLANA_CLUSTER,
        dropId: intent.dropId!,
        backer: backer.toBase58(),
        giver: treasury.publicKey.toBase58(),
        userId: backer.toBase58(),
        amountMicro: Number(toPot),
        channel: 'intents',
        sourceChain: intent.sourceChain,
        sourceAsset: intent.sourceAsset,
        sourceAmount: intent.sourceAmount,
        intentId: intent.id,
        message: `Sent from ${chain} with Aurora Intents`,
      })
      .onConflictDoUpdate({ target: dropGifts.ref, set: { amountMicro: Number(toPot) } })
  }
  intent = (await updateIntent(intent.id, { giveSignature: signature, giveValidUntil: lastValidBlockHeight, returnedMicro: Number(back) })) ?? intent

  try {
    await conn.sendRawTransaction(tx.serialize(), { maxRetries: 4 })
    const res = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
    if (res.value.err) return { intent, error: `The settling transaction failed: ${JSON.stringify(res.value.err)}` }
  } catch (e) {
    // Not necessarily lost: the next refresh checks the stored signature first.
    return { intent, error: (e as Error).message }
  }
  return finish(intent, signature)
}

async function finish(intent: Intent, signature: string): Promise<{ intent: Intent }> {
  const db = await getDb()
  if (intent.giveRef) await db.update(dropGifts).set({ status: 'confirmed', signature }).where(and(eq(dropGifts.ref, intent.giveRef), isNull(dropGifts.signature)))
  return { intent: (await updateIntent(intent.id, { settledAt: new Date(), ...(intent.returnedMicro ? { returnSignature: signature } : {}) })) ?? intent }
}

/** For the keeper: carries open or delivered-but-unsettled drop gifts forward even if the giver closed the tab. */
export async function reconcileDropIntents(conn: Connection, limit = 10) {
  if (!IS_MAINNET) return 0
  const db = await getDb()
  const rows = await db
    .select()
    .from(intents)
    .where(and(isNotNull(intents.dropId), isNull(intents.settledAt)))
    .limit(limit * 3)
  let n = 0
  for (const r of rows) {
    if (n >= limit) break
    if (r.status !== 'success' && !OPEN_STATES.has(r.status)) continue
    // Quotes nobody paid expire; stop polling them after a day.
    if (r.status === 'pending_deposit' && Date.now() - r.createdAt.getTime() > 24 * 3600_000) continue
    await refreshDropIntent(conn, r.id).catch((e) => console.warn('drop intent', r.id, (e as Error).message))
    n++
  }
  return n
}
