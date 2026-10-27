/**
 * Chain-level constants shared by server and client code.
 * Keep this file free of Node-only imports.
 */
export const LAMPORTS_PER_SOL = 1_000_000_000

export const SOLANA_CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta'
export const IS_MAINNET = SOLANA_CLUSTER === 'mainnet-beta'

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || (IS_MAINNET ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com')

/** CAIP-2 ids (used by Solana Actions / Blinks and x402). */
export const CAIP2_SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const CAIP2_SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
export const CAIP2_CURRENT = IS_MAINNET ? CAIP2_SOLANA_MAINNET : CAIP2_SOLANA_DEVNET

/** USDC mints (Circle). */
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
export const USDC_MINT = IS_MAINNET ? USDC_MINT_MAINNET : USDC_MINT_DEVNET

export const UMANITY_DONATIONS_PROGRAM_ID = process.env.NEXT_PUBLIC_DONATIONS_PROGRAM_ID || '9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1'
export const UMANITY_TIPS_PROGRAM_ID = process.env.NEXT_PUBLIC_TIPS_PROGRAM_ID || 'DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau'

/** Umanity organisation wallet: receives released escrow for in-person delivery. */
export const UMANITY_ORG_WALLET = process.env.NEXT_PUBLIC_UMANITY_ORG_WALLET || 'EsWeMEvuLDV2Q4CXigZbETzqXfEQwZntQjwD4Cy8AgY5'
/** Protocol treasury: receives x402 micropayments and protocol fees. */
export const UMANITY_TREASURY = process.env.NEXT_PUBLIC_UMANITY_TREASURY || 'BAScBKuDXCqdHxcoqdaDrUyJtFVtjBM5wS8tLd6tsgpy'

export function explorerTx(sig: string, cluster: string = SOLANA_CLUSTER) {
  return `https://solscan.io/tx/${sig}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`
}
export function explorerAccount(addr: string, cluster: string = SOLANA_CLUSTER) {
  return `https://solscan.io/account/${addr}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`
}

export function lamportsToSol(l: number | bigint): number {
  return Number(l) / LAMPORTS_PER_SOL
}
export function solToLamports(s: number): number {
  return Math.round(s * LAMPORTS_PER_SOL)
}
export function shortAddr(a: string, n = 4) {
  return a ? `${a.slice(0, n)}…${a.slice(-n)}` : ''
}
