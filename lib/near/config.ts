/**
 * Where Umanity's NEAR guard lives, and who talks to it. Server-only.
 *
 * - NEAR_GUARD_CONTRACT: the guard's account (e.g. guard.umanity.near). Unset → no guard.
 * - NEAR_NETWORK: mainnet or testnet. Solana mainnet pairs only with NEAR mainnet.
 * - NEAR_ACCOUNT_ID / NEAR_PRIVATE_KEY: the server's bot. It is the guard's registrar
 *   (it can register drops and nothing else) and pays the gas for verdicts and releases.
 * - NEAR_AI_API_KEY: NEAR AI Cloud, which runs the proof check inside a TEE.
 * - NEAR_AI_MODEL: the model the guard trusts (its signing key is registered on the guard).
 */
import { IS_MAINNET } from '@/lib/solana/constants'

export type NearNetwork = 'mainnet' | 'testnet'

export const NEAR_NETWORK: NearNetwork = process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
export const GUARD_CONTRACT = process.env.NEAR_GUARD_CONTRACT?.trim() || ''
export const MPC_CONTRACT = NEAR_NETWORK === 'mainnet' ? 'v1.signer' : 'v1.signer-prod.testnet'
export const NEAR_RPC_URLS = process.env.NEAR_RPC_URL
  ? [process.env.NEAR_RPC_URL]
  : NEAR_NETWORK === 'mainnet'
    ? ['https://rpc.mainnet.fastnear.com', 'https://rpc.mainnet.near.org']
    : ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org']

export const NEAR_AI_URL = 'https://cloud-api.near.ai/v1'
export const NEAR_AI_MODEL = process.env.NEAR_AI_MODEL?.trim() || 'Qwen/Qwen3-VL-30B-A3B-Instruct'

/** A guard is in use only on a matching network: a testnet guard never holds mainnet money. */
export function guardProblem(): string | null {
  if (!GUARD_CONTRACT) return 'No NEAR guard is set'
  if (IS_MAINNET && NEAR_NETWORK !== 'mainnet') return 'Solana mainnet needs the guard on NEAR mainnet'
  return null
}

export const guardEnabled = () => guardProblem() === null

export function nearExplorerTx(hash: string) {
  return `https://${NEAR_NETWORK === 'mainnet' ? '' : 'testnet.'}nearblocks.io/txns/${hash}`
}

export function nearExplorerAccount(id: string) {
  return `https://${NEAR_NETWORK === 'mainnet' ? '' : 'testnet.'}nearblocks.io/address/${id}`
}
