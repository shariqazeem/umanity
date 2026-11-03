# For judges

Live: **https://umanity.vercel.app**. Everything runs on Solana devnet; no wallet is needed to browse. The README's **Try it (do X → see Y)** is the full walkthrough. Shortest paths per track:

## Best Consumer App (5 minutes)
1. `/home` → the feed, live ticker, stats, leaderboard.
2. **Sign in → Create a Umanity wallet** (created in the browser, topped up on devnet).
3. **Give → press the black circle** → *Gift confirmed* → **Follow your gift** → the six-step tracker with a transaction for each step.
4. **Feed → ⚡ Dare a friend**, **Profile** → Living Guardian pass, streak, certificates, receipts.
5. Paste a `/causes/<id>` or `/gift/<id>` link into X or a chat → the share card shows the live escrow or the gift's progress.

## Best Use of x402 (3 minutes)
1. `/agents` → **▶ Pay $0.10 … via x402** → 402 → sign → settled → receipt with a verified ed25519 signature → follow the gift.
2. `npm run x402:failures` → 400 (bad body, never asked to pay), 402, 200, replay refused.
3. `AGENT_KEYPAIR_PATH=~/.config/solana/devnet.json npx tsx scripts/mcp-smoke.ts` → Claude's MCP tools give and follow a gift.
4. Code: `lib/x402/server.ts` (verify → handler → settle → commit, replay guard, cancellation), `app/api/x402/give/route.ts`, `lib/receipt.ts`, `mcp/server.ts`.

## Aurora Intents (3 minutes)
1. **Give → Give from another chain** → pick a chain and asset → live solver quote (the routing fee shows once an Aurora key is configured).
2. Enter a refund address → real deposit address and QR → status *pending → swapping → settled → deposited into escrow*; short deposits and refunds are explained.
3. Code: `lib/intents/oneclick.ts` (Aurora Swap API when `AURORA_API_KEY` is set, 1Click otherwise), `lib/intents/settle.ts` (atomic settlement, escrow forward, credit once), `app/api/intents/reconcile/route.ts`.
4. `npx tsx scripts/donate-all.ts clean-water 0.02` → a fresh account gives its whole balance with `donate_all` (the instruction Intents Connect calls on arrival), ends at 0 lamports, and the server books the gift from the chain.

## Escrow and proof
- `programs/risen-donations/src/lib.rs`: vaults, milestones, attestations, dares, refunds. v2.1 is live on devnet with no withdraw path, and its IDL is on-chain, so Explorer shows every instruction by name.
- `/govern` → delivery proof, *Audit this proof · $0.01* (x402), donor vote, release transaction. `/transparency` → the public ledger.

Programs (devnet): donations `9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`, tips `DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`.
