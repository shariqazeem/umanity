# For judges

Everything you need is in the README's **"Try it in 5 minutes (do X → see Y)"** section. Short version:

1. Open the app, click **⚡ demo wallet** (no wallet install, devnet SOL is funded for you).
2. **Give & Bridge → Solana → 0.01 SOL one-tap** → Solscan link, points, certificate, telemetry updates.
3. **Feed** → like / comment / boost a live dare / launch your own staked dare (real `create_dare` transaction).
4. **Govern** → open the orphanage proposal → **Evidence** → **Verify via x402 · $0.01** (needs devnet USDC: faucet.circle.com) → attestation hash on-chain → vote.
5. **Give & Bridge → Any chain** → live NEAR Intents quote from Base/ETH/BTC/TON/NEAR → deposit address (mainnet settlement).
6. **Profile & Pass** → Living Guardian, certificates, receipts, Blinks.

Programs (devnet): donations `9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`, tips `DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`.

Paid endpoints (x402 on Solana): `POST /api/x402/verify-milestone`, `POST /api/x402/sponsor-dare`. Agent example: `npm run x402:agent -- <milestoneId> https://umanity-solana.vercel.app`.

Blinks: `GET /api/actions/donate/<poolId>` and `GET /api/actions/dare/<dareId>` (test on dial.to with `cluster=devnet`).

Where the real work is: `programs/risen-donations/src/lib.rs` (14 instructions), `lib/solana/*` (verification, authority ops), `lib/x402/server.ts`, `lib/intents/oneclick.ts`, `lib/oracle/impact-oracle.ts`, `lib/db/schema.ts`, `scripts/seed-devnet.ts`.
