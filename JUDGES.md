# For judges

The README's **Try it (do X → see Y)** is the full walkthrough. Below is the shortest path for each track. No wallet is needed to browse.

**Live demo:** https://umanity.vercel.app on Solana devnet. Drop #3 is a labelled demo you can give to: get free test USDC at [faucet.circle.com](https://faucet.circle.com) (Solana Devnet) for your Umanity wallet's address. It is called off after judging and the program refunds every backer.

## Best Consumer App (5 minutes)
1. `/` → landing with live totals from the program. `/home` → the next drop and its black circle, plus a feed of gifts, filmed proof, unlocks and fee splits, each with its transaction.
2. **Sign in → Create a Umanity wallet → press the black circle** → pick an amount → *it's in the pot*. Umanity paid the network fee; you never need SOL.
3. Open the drop → four steps with transactions; the description and proof are checked against their on-chain hashes.
4. **Money** → every dollar from gift or fee to pot, payout or refund, read from the chain. **Trade** → Jupiter swaps whose 0.5% fee lands in the program's fee inbox, half for drops. **Me** → drops backed, receipts, points, streak.

## Best Use of x402 (3 minutes)
1. `/agents` → **▶ Pay into a drop via x402** → 402 → sign → settled → the USDC goes into the pot with your wallet as the backer → signed receipt, verified in the browser.
2. `GET /api/x402/give` → the drops that are filling, the room in each pot, and how to pay.
3. `mcp/server.ts` → Claude can `list_drops`, `get_drop`, and `give` with spend caps.
4. Code: `app/api/x402/give/route.ts` (refused before payment if the drop can't take it; `give` with `backer = payer` after settlement), `lib/x402/server.ts`, `lib/receipt.ts`. Failure cases: `npm run x402:failures`.

## Aurora Intents (mainnet)
1. Any drop → **Give** → **Or pay from 30+ chains** → pick an asset (USDC on Base, ETH, BTC, NEAR…) → exact price for the amount you chose.
2. **Get my deposit address** → send from any wallet or exchange → the status goes *waiting → swapping → in the pot ✓*, with the Solana transaction that put it there in your name.
3. Edge cases handled: an incomplete deposit shows what's missing; a failed swap is refunded on your chain by NEAR Intents; if the pot filled meanwhile, the overflow goes to your own USDC account in the same transaction; a missed delivery date refunds you on Solana.
4. Code: `lib/umanity/intents.ts` (quote, settle, never pay twice), `app/api/drops/[id]/intents/route.ts`, `app/api/drops/intents/[intent]/route.ts`, `components/drops/AnyChainGive.tsx`. On devnet the sheet shows live prices only, because NEAR Intents has no test network.

## The money rules (all tracks)
- `programs/umanity/src/lib.rs`: 18 instructions; `bash scripts/test-programs.sh` runs 7 tests against Meteora's real DBC program cloned from mainnet.
- Gifts go 100% to drops; fees split 50/50 by code; the drops fund can only pay into pots; refunds can only go to their backer; an unlock must name the exact proof it pays for; the unlock key can be locked for good.

Program: `UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`.
