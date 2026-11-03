import { NextRequest } from 'next/server'
import { ok, fail, readJson, errorMessage, isPubkey, rateLimit, clientIp } from '@/lib/api'
import { getQuote, getTokens, SOLANA_DEST_ASSETS, INTEGRATOR_FEE_BPS, intentsProvider, parseUnits, deadlineMinutesFor } from '@/lib/intents/oneclick'
import { CROSSCHAIN_VAULT } from '@/lib/intents/config'
import { createIntentRecord } from '@/lib/data/intents'
import { getCause } from '@/lib/causes'

export const runtime = 'nodejs'

const EVM_CHAINS = new Set(['eth', 'base', 'arb', 'op', 'pol', 'bsc', 'avax', 'gnosis', 'bera', 'monad', 'aurora', 'plasma', 'scroll', 'xlayer', 'adi'])
const BTC_LIKE: Record<string, string> = {
  btc: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  ltc: 'ltc1qd4r4vk7qf7q6v7vz2n4d2dxv8h5c0cgtl8w2kz',
  doge: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
  bch: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
}
/** Valid-looking refund addresses used only for dry (preview) quotes. Live quotes always use the user's own. */
function placeholderRefund(chain: string, userSolana: string | null): string | null {
  if (chain === 'sol') return userSolana || CROSSCHAIN_VAULT
  if (EVM_CHAINS.has(chain)) return '0x1111111111111111111111111111111111111111'
  if (BTC_LIKE[chain]) return BTC_LIKE[chain]
  if (chain === 'near') return 'intents.near'
  return null
}

/**
 * POST /api/intents/quote
 * { originAsset, amount (human units), poolId, refundTo, userAddress?, dry?, destAsset?: 'SOL'|'USDC' }
 *
 * dry=true  → free price preview (no deposit address, no key needed)
 * dry=false → real quote with a one-off deposit address; an `intents` row is
 *             created so /api/intents/status can track it to settlement.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ originAsset?: string; amount?: string | number; poolId?: string; refundTo?: string; userAddress?: string; dry?: boolean; destAsset?: 'SOL' | 'USDC'; dareId?: string }>(req)
  if (!body.originAsset || !body.amount || !body.poolId || !getCause(body.poolId)) return fail('originAsset, amount and poolId required')
  const dry = body.dry !== false
  if (!dry && !rateLimit(`intent:${clientIp(req)}`, 20, 60 * 60 * 1000)) return fail('Too many quotes, slow down', 429)
  if (!dry && !body.refundTo) return fail('refundTo (an address on the origin chain) is required for a live quote')
  try {
    const tokens = await getTokens()
    const token = tokens.find((t) => t.assetId === body.originAsset)
    if (!token) return fail('Unknown origin asset')
    const human = Number(body.amount)
    if (!(human > 0)) return fail('Amount must be positive')
    let smallest: string
    try {
      smallest = parseUnits(String(body.amount), token.decimals).toString()
    } catch {
      return fail('Invalid amount')
    }
    const destinationAsset = SOLANA_DEST_ASSETS[body.destAsset || 'SOL']
    // Dry quotes still require a syntactically valid refund address on the origin chain.
    const placeholder = dry ? placeholderRefund(token.blockchain, isPubkey(body.userAddress) ? body.userAddress! : null) : null
    const refundTo = body.refundTo || placeholder
    if (!refundTo) return fail(`Enter a refund address on ${token.blockchain.toUpperCase()} to get a quote`, 400, { needsRefundAddress: true })
    const quote = await getQuote({ originAsset: body.originAsset, destinationAsset, amount: smallest, recipient: CROSSCHAIN_VAULT, refundTo, dry, referral: 'umanity', deadlineMinutes: deadlineMinutesFor(token.blockchain) })
    let intentId: string | null = null
    if (!dry) {
      const row = await createIntentRecord({
        userAddress: isPubkey(body.userAddress) ? body.userAddress! : null,
        poolId: body.poolId,
        dareId: body.dareId ?? null,
        status: 'pending_deposit',
        sourceChain: token.blockchain,
        sourceAsset: token.symbol,
        sourceAmount: String(human),
        destAsset: body.destAsset || 'SOL',
        destAddress: CROSSCHAIN_VAULT,
        depositAddress: quote.quote.depositAddress ?? null,
        depositMemo: quote.quote.depositMemo ?? null,
        quote: quote as unknown as Record<string, unknown>,
        integratorFeeBps: INTEGRATOR_FEE_BPS,
      })
      intentId = row.id
    }
    // Show the fee that was actually applied to this quote, not the configured one.
    const applied = (quote.quoteRequest?.appFees as { fee?: number }[] | undefined)?.reduce((n, f) => n + (f.fee ?? 0), 0)
    const feeBps = intentsProvider() === 'aurora' ? INTEGRATOR_FEE_BPS : applied ?? 0
    const feeUsd = quote.quote.amountInUsd ? (Number(quote.quote.amountInUsd) * feeBps) / 10_000 : null
    return ok({
      dry,
      intentId,
      provider: intentsProvider(),
      token: { symbol: token.symbol, chain: token.blockchain, decimals: token.decimals },
      recipient: CROSSCHAIN_VAULT,
      quote: quote.quote,
      fee: { bps: feeBps, usd: feeUsd, note: intentsProvider() === 'aurora' ? 'Integrator fee set per key in the Aurora Intents portal (60/40 with Aurora)' : feeBps > 0 ? 'appFees via NEAR Intents 1Click' : 'No integrator fee on this quote' },
      timestamp: quote.timestamp,
    })
  } catch (e) {
    return fail(errorMessage(e), 502)
  }
}
