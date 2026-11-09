# For judges

**Umanity is live on Solana mainnet: https://umanity-mainnet.vercel.app**

Real USDC. Gifts start at $1, and Umanity pays the network fee. No wallet is needed to browse. The README's **Try it (do X → see Y)** is the full walkthrough; below is the shortest path for each track.

Program [`UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`](https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3) on mainnet since 9 Nov 2026. Every number on the site is read from it.

## Best Consumer App (5 minutes)
1. `/` → the landing, with live totals read from the program. `/home` → the live drop and its black circle, plus a feed of gifts, filmed proof, unlocks and fee splits, each with its transaction.
2. **Sign in → Create a Umanity wallet.** It's locked with Face ID or a passcode and sealed on your device. Put a few USDC in it: send from any Solana wallet to the address in the wallet sheet, or pay from another chain (see Aurora below).
3. **Press the black circle → pick an amount → it's in the pot.** Umanity paid the network fee; you never need SOL.
4. Open the drop → its promise (shopping list, place, date) is checked against the hash on-chain, next to the pot, the backers and four steps with a transaction each.
5. **Money** → every dollar from gift or fee to pot, payout or refund, read from the chain. **Trade** → Jupiter swaps whose 0.5% fee lands in the program's fee inbox, half for drops. **Me** → the drops you backed, as gift tickets.

## Best Use of x402 (3 minutes)
1. `/agents` → **▶ Pay into a drop via x402** → 402 → your wallet signs a USDC transfer → the PayAI facilitator settles it on Solana mainnet → the same USDC goes into the pot with your wallet as the backer → a signed receipt, verified in the browser.
2. `GET /api/x402/give` → the drops that are filling, the room in each pot, and how to pay.
3. `mcp/server.ts` → Claude can `list_drops`, `get_drop`, and `give` with spend caps.
4. Code: `app/api/x402/give/route.ts` (a gift the drop can't take is refused before any 402; after settlement, `give` runs with `backer = payer`), `lib/x402/server.ts`, `lib/receipt.ts`. Failure cases: `npm run x402:failures`.

## Aurora Intents (live on mainnet)
1. Any drop → **Give** → **Or pay from 30+ chains** → pick what you hold (216 assets on 39 chains: USDC on Base, ETH, BTC, NEAR…) → the exact price for the amount you chose.
2. **Get my deposit address** → send from any wallet or exchange → the status goes *waiting → swapping → in the pot ✓*, with the Solana transaction that put it there in your name.
3. Edge cases handled:
   - an incomplete deposit shows what's missing;
   - a failed swap is refunded on your chain by NEAR Intents;
   - if the pot filled meanwhile, the overflow goes to your own USDC account in the same transaction;
   - a missed delivery date refunds you on Solana.
4. Code: `lib/umanity/intents.ts` (quote, settle, never pay twice), `app/api/drops/[id]/intents/route.ts`, `app/api/drops/intents/[intent]/route.ts`, `components/drops/AnyChainGive.tsx`.

## The money rules (all tracks)
- `programs/umanity/src/lib.rs`: 18 instructions. `bash scripts/test-programs.sh` runs 7 tests against Meteora's real DBC program cloned from mainnet.
- Gifts go 100% to drops, and fees are split 50/50 by code. The drops fund can only pay into pots, and refunds can only go to their backer. An unlock must name the exact proof it pays for, and the unlock key can be locked for good.
- Today Umanity's key signs unlocks. The NEAR guard that takes that key over is deployed on NEAR mainnet: [NEAR.md](NEAR.md).
