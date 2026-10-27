/**
 * Where cross-chain donations settle. NEAR Intents is mainnet only, so the
 * destination is a mainnet Solana wallet controlled by Umanity ("cross-chain
 * cause vault"). Each settled intent is credited to the chosen cause in the
 * ledger and, once the escrow program is deployed to mainnet, executed into the
 * Anchor vault directly via Intents Connect.
 */
export const CROSSCHAIN_VAULT = process.env.NEXT_PUBLIC_UMANITY_CROSSCHAIN_VAULT || process.env.NEXT_PUBLIC_UMANITY_TREASURY || 'BAScBKuDXCqdHxcoqdaDrUyJtFVtjBM5wS8tLd6tsgpy'

export const INTENTS_ENABLED = process.env.NEXT_PUBLIC_INTENTS_ENABLED !== 'false'

export const INTENTS_EXPLORER = 'https://explorer.near-intents.org'
