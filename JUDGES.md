# For judges

The README's **"Try it in 5 minutes (do X → see Y)"** section is the walkthrough. Short version:

1. **Sign in → Create a Umanity wallet** (self-custodial, created in the browser; topped up on devnet).
2. **Give → $5** to any cause → "Thank you.", on-chain link, points, certificate. The server verified the vault's balance change before crediting.
3. **Home** → your gift in the stream, streak started, "Give today" progress moved.
4. **/causes/orphan-care** → escrow numbers, what a gift buys, delivery log with photos and receipts, the oracle verdict, the donor vote, the vault with milestones and release transactions.
5. **Audit this proof · $0.01** → HTTP 402 paid in USDC over x402, verdict with per-check marks, attestation hash written on-chain.
6. **/transparency** → vault table, releases, deliveries, fees, programs and wallets.
7. **/admin** (field-team wallet) → post a delivery with photos, attach it to a milestone, open the vote, notify donors; close the vote; release on-chain.

Programs (devnet): donations `9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`, tips `DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`.

Paid endpoints (x402 on Solana): `POST /api/x402/verify-milestone` ($0.01), `POST /api/x402/sponsor-dare` ($0.05). Agent example: `npm run x402:agent -- <milestoneId> <baseUrl>`.

Cross-chain: `POST /api/intents/quote` (dry quotes are free and keyless), `GET /api/intents/status?id=`. Blinks: `GET /api/actions/donate/<causeId>`, `GET /api/actions/dare/<dareId>`.

Where the real work is: `programs/risen-donations/src/lib.rs` (14 instructions), `lib/solana/*` (verification, authority ops, bootstrap), `lib/x402/server.ts`, `lib/intents/oneclick.ts`, `lib/oracle/impact-oracle.ts`, `lib/data/*`, `lib/admin-auth.ts`, `components/give/GiveSheet.tsx`.
