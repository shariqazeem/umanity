# For judges

**Umanity is live on Solana mainnet: https://umanity.gives**

Real USDC. Gifts start at $1, and Umanity pays the network fee. No wallet is needed to browse. The README's **Try it (do X → see Y)** is the full walkthrough; below is the shortest path for each track.

Program [`UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`](https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3) on mainnet since 9 Nov 2026. Every number on the site is read from it.

## Proof: one real gift each way, 9 Nov 2026
On launch day the team gave $1 to [Drop #1](https://umanity.gives/drops/1) each way you can give. Its pot holds $16.49: $13.49 from $UMANITY trading fees and these three gifts.

| Way | What happened | Transactions |
| --- | --- | --- |
| **One tap** | A Umanity wallet unlocked with Touch ID gave $1. The treasury paid the network fee. | [give](https://solscan.io/tx/4RmusH4RUrDhSf1YsBuMP6bxSFfPT4FR4ETvYRngK4htQjs9nSysHXT96Q9LZJ8hRXgvDh5MzsqtQF2oJnNFS2QD) |
| **x402** | An agent paid $1 in USDC and PayAI settled it. One second later, `give` put it in the pot with the agent's wallet as the backer. | [payment](https://solscan.io/tx/5e9JGdx3KjvjYoad5WXf3iWFAJJn7kuy2VufCYnWesGmFuEkHZwh2iGG8pdHFhpF4x9DSRGzAktTgqttgkrBwRaw) · [give](https://solscan.io/tx/5GQFEkVuswDHqAFmESNcsH8dfbGkWTZa6HNWbc32bivHBU7nUknkcczMZcSo7NGyS6EwfKQ9bRn2qkPRfPYNbuYm) |
| **Aurora Intents** | 0.000477 ETH sent on Ethereum. NEAR Intents delivered exactly 1.000000 USDC on Solana, and 3 seconds later it was in the pot in the giver's name. 2 min 40 s from deposit to pot. | [deposit on Ethereum](https://etherscan.io/tx/0xf374cf6e02742c374f9d644f6a39f684a02deb6117e5d4f0da79b72bf5d7c3e7) · [USDC delivered](https://solscan.io/tx/4PyvGfn5EGj7vPk2c2TgmgCTUxPGuAJcnrWqARRzCLVVWfgvWshVSVryC1srBpzUaAwfp5giwoUG6fmUaRCh6n5f) · [give](https://solscan.io/tx/2tZXjMZJiRemYr8ub7eoucNZWWRFnJtc4vsQaRGZWBRFnGxqqCf7YwKQHyyy63Hn8M8hcM6pR5PQ9vGp8avDBmp5) |

## Best Consumer App (5 minutes)
1. `/` → the landing, with live totals read from the program. `/home` → the live drop and its black circle, plus a feed of gifts, filmed proof, unlocks and fee splits, each with its transaction.
2. **Sign in → Create a Umanity wallet.** It's locked with Face ID or a passcode and sealed on your device. Put a few USDC in it: send from any Solana wallet to the address in the wallet sheet, or pay from another chain (see Aurora below).
3. **Press the black circle → pick an amount → it's in the pot.** Umanity paid the network fee; you never need SOL.
4. Open the drop → its promise (shopping list, place, date) is checked against the hash on-chain, next to the pot, the backers and four steps with a transaction each.
5. **Money** → every dollar from gift or fee to pot, payout or refund, read from the chain. **Trade** → the live $UMANITY card (its trading fees can only be claimed by the program, which splits them 50/50), plus Jupiter swaps whose 0.5% fee lands in the program's fee inbox, half for drops. **Me** → the drops you backed, as gift tickets.

## Best Use of x402 (3 minutes)
1. `/agents` → **▶ Pay into a drop via x402** → 402 → your wallet signs a USDC transfer → the PayAI facilitator settles it on Solana mainnet → the same USDC goes into the pot with your wallet as the backer → a signed receipt, verified in the browser.
2. `GET /api/x402/give` → the drops that are filling, the room in each pot, and how to pay.
3. `mcp/server.ts` → Claude can `list_drops`, `get_drop`, and `give` with spend caps.
4. Code: `app/api/x402/give/route.ts` (a gift the drop can't take is refused before any 402; after settlement, `give` runs with `backer = payer`), `lib/x402/server.ts`, `lib/receipt.ts`. Failure cases: `npm run x402:failures`.

## Aurora Intents (live on mainnet)
A real gift from Ethereum settled on 9 Nov: see Proof above.
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
