/** Tokens the Trade tab offers first. Mainnet mints: Jupiter routes on mainnet only. */
export type TradeToken = { symbol: string; name: string; mint: string; decimals: number }

const BASE: TradeToken[] = [
  { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
]

/** $UMANITY joins the list once its mint is set (after launch). */
export const UMANITY_MINT = process.env.NEXT_PUBLIC_UMANITY_MINT || null
export const TRADE_TOKENS: TradeToken[] = UMANITY_MINT ? [BASE[0], BASE[1], { symbol: 'UMANITY', name: 'Umanity', mint: UMANITY_MINT, decimals: 6 }, ...BASE.slice(2)] : BASE
export const tradeToken = (symbol: string) => TRADE_TOKENS.find((t) => t.symbol === symbol)
