/** USDC addresses without the Anchor client, for light client bundles. */
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { USDC_MINT } from '@/lib/solana/constants'

/** Overridable for local validators, which mint their own "USDC". */
export const USDC = new PublicKey(process.env.NEXT_PUBLIC_UMANITY_USDC_MINT || USDC_MINT)
export const usdcAccount = (owner: PublicKey, mint = USDC) => getAssociatedTokenAddressSync(mint, owner, true)
