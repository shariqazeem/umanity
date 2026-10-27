import { NextRequest } from 'next/server'
import { ok, fail, isPubkey, readJson, rateLimit, clientIp, errorMessage } from '@/lib/api'
import { fundFromTreasury } from '@/lib/solana/server-signer'
import { getBalanceSol } from '@/lib/solana/chain'
import { IS_MAINNET } from '@/lib/solana/constants'
import { ensureUser, toPublicUser } from '@/lib/data/users'

export const runtime = 'nodejs'

/**
 * POST /api/wallet/faucet { address }
 * Tops a new wallet up with devnet SOL from the treasury so the first gift is
 * one tap away. Devnet only, rate limited; returns 403 on mainnet.
 */
export async function POST(req: NextRequest) {
  if (IS_MAINNET) return fail('The faucet is devnet only', 403)
  const body = await readJson<{ address?: string }>(req)
  if (!isPubkey(body.address)) return fail('Valid address required')
  const ip = clientIp(req)
  if (!rateLimit(`fund:${ip}`, 6, 60 * 60 * 1000) || !rateLimit(`fund:${body.address}`, 2, 24 * 60 * 60 * 1000)) {
    return fail('Rate limit: try again later or use faucet.solana.com', 429)
  }
  try {
    const current = await getBalanceSol(body.address)
    if (current >= 0.2) {
      const user = await ensureUser(body.address)
      return ok({ funded: false, balance: current, user: toPublicUser(user), message: 'Wallet already funded' })
    }
    const { signature, lamports } = await fundFromTreasury(body.address, 0.25)
    const user = await ensureUser(body.address)
    return ok({ funded: true, signature, amount: lamports / 1e9, balance: current + lamports / 1e9, user: toPublicUser(user) })
  } catch (e) {
    console.error('fund demo wallet', e)
    return fail(errorMessage(e), 500)
  }
}
