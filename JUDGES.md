# For judges

The README's **Try it (do X → see Y)** is the full walkthrough. Below are the shortest path for each track. No wallet is needed to browse.

## Best Consumer App (5 minutes)
1. `/` → landing with live totals from the program. `/home` → the next drop and its black circle, plus a feed of gifts, filmed proof, unlocks and fee splits, each with its transaction.
2. **Sign in → Create a Umanity wallet → press the black circle** → pick "1 ration pack" → *$30 is in the pot*. Umanity paid the network fee.
3. Open the drop → four steps with transactions; description and proof are checked against their on-chain hashes.
4. **Money** → every dollar from gift or fee to pot, payout or refund. **Trade** → Jupiter swaps whose 0.5% fee lands in the program's fee inbox, half for drops. **Me** → drops backed, receipts, points, streak.

## Best Use of x402 (3 minutes)
1. `/agents` → **▶ Pay into a drop via x402** → 402 → sign → settled → the USDC goes into the pot with your wallet as the backer → signed receipt, verified in the browser.
2. `GET /api/x402/give` → the drops that are filling, the room in each pot, and how to pay.
3. `mcp/server.ts` → Claude can `list_drops`, `get_drop`, and `give` with spend caps.
4. Code: `app/api/x402/give/route.ts` (refused before payment if the drop can't take it; `give` with `backer = payer` after settlement), `lib/x402/server.ts`, `lib/receipt.ts`.

## Aurora Intents
- Cross-chain gifts settle as USDC on Solana and go into a pot with `give`; Intents Connect calls `open_backer` + `give_all` (whatever arrived). Code: `lib/intents/*`, `programs/umanity/src/lib.rs` (`give_all`).

## The money rules (all tracks)
- `programs/umanity/src/lib.rs`: 18 instructions; `bash scripts/test-programs.sh` runs 7 tests against Meteora's real DBC program cloned from mainnet.
- Gifts go 100% to drops; fees split 50/50 by code; the drops fund can only pay into pots; refunds can only go to their backer; the unlock key can be locked for good.

Program: `UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`.
