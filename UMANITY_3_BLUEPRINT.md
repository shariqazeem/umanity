# Umanity 3.0 — Execution Blueprint (reviewed and revised)

Status: living document. Written 27 Oct 2026 after a full read of the codebase, the on-chain state on devnet, and primary-source research on Aurora Intents, NEAR Intents, x402 on Solana, MultiHopper and the NEAR hackathon rules.

Targets (in priority order):

| # | Hackathon | What we go for | Dates |
|---|-----------|----------------|-------|
| 1 | Encode x Solana Hackathon 2026 | Aurora Intents 1st ($1,500 + BD bundle), Best Consumer App (accelerator), Best Use of x402 (accelerator) | Checkpoint Mon 2 Nov, final Sun 8 Nov 23:59 UTC-12 |
| 2 | NEAR Hackathon "Build Beyond Boundaries" | Real-World Money, Agent Economy, Social Money, Open Innovation (track prizes $10k/$3k/$2k, grand prize $55k, paid in NEAR) | Build 1–14 Nov, submit by 14 Nov 23:59 UTC |
| 3 | MultiHopper Build & Route Challenge | Integration + revenue share; prize needs $100k real mainnet volume by 30 Nov, treated as a long shot | Window 21 Oct–30 Nov |

## 1. The idea, restated in one paragraph

Umanity is the social network where giving is the content. Every donation is escrowed on Solana, released only when the community votes that a milestone was delivered, and the proof of delivery is audited by an AI Impact Oracle that anyone (or any agent) can pay per request. Two of the six causes are delivered in person by the Umanity team (the "Field Fund"): receipts, photos and geotags are posted, hashed and attested on-chain. Donors can give from any of 31+ chains through NEAR Intents (via Aurora), whales can give discreetly, and friends can stake SOL to dare each other into giving. That is the whole product. Everything in this document serves it.

## 2. Facts from research that change the plan

1. NEAR Intents and Aurora Intents are mainnet only. There is no testnet and none is planned. Solana devnet cannot be a destination. The cross-chain flow has to be demoed with a small real mainnet transaction. Dry quotes (`dry: true`) are free and work without a key, so the UI can show real pricing for every chain at zero cost.
2. Aurora's "execute on arrival" (Intents Connect) needs our Anchor program on mainnet and forbids extra keypair signers in the instruction. The v1 `donate_to_pool` needed a fresh keypair for the record, so it could never be called by Intents Connect or cleanly by a Blink. v2 adds a PDA-record `donate` instruction.
3. Intents Deposits persistent addresses are gated (403 until Aurora approves the organisation). The Swap API per-swap deposit address and the 1Click API are not gated. We build on those first and ask Aurora for persistent-address access as a bonus.
4. x402 on Solana works on devnet today with the x402.org facilitator (no key), USDC only (native SOL is not allowed by the exact-SVM scheme), devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. The official Next helper requires Next 16, so we use `@x402/core` + `@x402/svm` directly in a route handler.
5. MultiHopper has a full devnet with `mh_test_` keys (wallet-connect dashboard), a multi-step API (estimate, create, prepare, sign, confirm, poll), no SDK, is pre-audit, and only mainnet volume counts. We integrate on devnet for the product feature and onboard to mainnet after the Solana submission.
6. The NEAR hackathon jury includes Claude Code and Codex as AI judges. The README must be written for a machine reader: what it does, the problem, and "do X, see Y" steps. Tracks are chosen by id; naming the primitives used (NEAR Intents, meta-transactions, function-call keys, Sputnik DAO, NEAR AI Cloud attestation) in the README matters.
7. Two defects found in the deployed v1 program: campaigns and milestones were never created on-chain (governance ran only in Supabase), and the vault debits in `release_milestone_funds`, `withdraw_from_pool` and `claim_refund` used direct lamport subtraction from a system-owned PDA, which the runtime rejects. v2 fixes both with CPI transfers signed by the vault PDA.
8. The repository could not build from a fresh clone: the IDL JSON files were git-ignored. They are now generated and committed.

## 3. What changes versus the Gemini blueprint, and why

Kept, because they are honest and winnable:

- Zero-friction entry: no blocking onboarding wizard; a wallet gets an auto-generated handle and a non-blocking "claim your @handle" card.
- A top telemetry bar, a 3-column shell, the Apple-grade light design system already in the codebase.
- Cross-chain Give & Bridge terminal (Aurora/NEAR Intents), the discreet route (MultiHopper), the x402 AI Impact Oracle, staked Impact Dares, the Living Guardian pass with streaks, Blinks for dares.
- The five fee streams, with the Dare fee (1.5%) now enforced on-chain.

Changed:

- No fabricated numbers. The blueprint proposed a `live-fallback-data.ts` with "$48,920 TVL" and "$1,420 fees earned". AI judges read the code; human judges click Solscan. Every number on screen comes from devnet state or the database, and a seed script creates real devnet transactions (campaigns, milestones, donations from demo wallets, dares) so nothing is empty. Devnet is labelled as devnet.
- "1-Click Judge Sandbox" becomes an "Instant demo wallet": a burner keypair generated in the browser and funded with devnet SOL by our treasury through an API. It is real signing on a real network, no shared server key, and it doubles as the consumer onboarding path for people without a wallet.
- Impact Shares bonding curve, No-Loss Yield Vault, Weekly Jackpot lottery and the $UMAN token are deferred to post-hackathon. Reasons: no real yield source exists on devnet, a lottery is a regulated activity in most jurisdictions including Pakistan, a token launched inside a hackathon is a red flag for the a16z/Dragonfly judges on the NEAR panel, and the bonding-curve mechanic turns charity into speculation, which hurts the consumer-app narrative. The tokenomics stay in the doc as the mainnet roadmap; impact points remain the unit now.
- Supabase and Tapestry are no longer hard dependencies. The data layer is Postgres through Drizzle (`DATABASE_URL`), with an embedded PGlite database for local dev. Tapestry becomes an optional mirror. This is what makes "Failed to create user" impossible and lets the app run on the Ubuntu server, on Vercel + Supabase/Neon, or on a laptop with no setup.
- The Field Fund is explicit. Two causes are "field" causes; the oracle verifies receipts and geotagged photos; releases are recorded on-chain with `attest_milestone`. This is the real-world asset story the project was always about and it fits NEAR's Real-World Money track.

## 4. Architecture

```
Browser (Next.js 15, React 19, wallet-adapter or instant demo wallet)
   |            |                |                   |
   | Anchor tx  | /api/*         | 1Click / Aurora   | x402 paid fetch
   v            v                v                   v
Solana devnet   Next.js API routes (Node runtime)  NEAR Intents (mainnet)  x402.org facilitator
   |              |  Drizzle -> Postgres (DATABASE_URL) or PGlite (dev)
   |              |  chain verifier (every client-reported tx is re-read from RPC)
   |              |  AI Impact Oracle (Claude; NEAR AI Cloud optional for signed TEE attestations)
   |              '- MultiHopper devnet API (discreet route, multi-send payouts)
   '- umanity_donations v2: pools, PDA donations, campaigns, milestones, attestations, dares
```

Programs (devnet, same IDs as before):

- `umanity_donations` v2 `9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`: `initialize_pool`, `one_tap_donate`, `donate_to_pool` (v1), `donate` (PDA record), `create_campaign`, `init_milestone`, `attest_milestone`, `approve_milestone`, `release_milestone_funds`, `claim_refund`, `withdraw_from_pool`, `create_dare`, `boost_dare`, `settle_dare`.
- `umanity_tips` `DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`: unchanged.

Data model (`lib/db/schema.ts`): users, follows, posts, likes, comments, pools, donations, tips, campaigns, milestones (with evidence + attestation JSON), proposals, votes, dares, dare_stakes, intents, x402_receipts, routed_transfers, notifications, impact_certificates, field_deliveries.

Revenue streams, all real:

| Stream | Where it is enforced | Rate |
|--------|----------------------|------|
| Cross-chain integrator fee | 1Click `appFees` / Aurora Studio key | 50 bps (we keep 50–60%) |
| Dare settlement fee | on-chain `settle_dare` to `PROTOCOL_TREASURY` | 1.5% of pot |
| x402 oracle calls | facilitator settles USDC to treasury | $0.01 per audit, $0.05 per sponsored dare |
| MultiHopper discreet route and payouts | on-chain atomic split | 0.25% of volume |
| Field Fund allocation | governance-set share of protocol revenue, published | starts at 20% |

## 5. Screens (what judges click)

1. Feed: composer (post / launch a dare), live dares rail with ticking pots and "Boost pot", stream of donation stories with source-chain badges, milestone proofs, votes, dares. Like, comment, follow, share-as-Blink all work for guests after a one-click demo wallet.
2. Causes: six market-style cause cards with the escrow bar (vault balance / target, milestone n of 3), accepted rails strip, and three actions: Give (SOL), Give from any chain, Dare a friend.
3. Give & Bridge: three modes. Any-chain (Aurora/NEAR Intents: pick chain and asset, see a live quote with fee breakdown, get a deposit address + QR, watch status to settlement), Solana (one-tap 0.01 SOL, custom amount, discreet-route toggle with the MultiHopper hop preview), Demo wallet (fund and go).
4. Govern: voting power, escrow awaiting vote, proposal cards with the oracle attestation panel ("Re-verify via x402"), approve/reject, execute, and the on-chain release button for the authority with the Solscan link.
5. Profile: Living Guardian pass (Seed → Sprout → Bloom → Guardian → Sovereign, driven by streak and points), holdings (certificates, open dares, intents), on-chain receipts, shareable Blinks, referral link.
6. Right rail: protocol telemetry (escrowed, cross-chain volume, discreet volume, oracle calls), leaderboard tabs, live activity ticker.

## 6. Win plan per hackathon

Encode x Solana (final 8 Nov):

- Aurora Intents: working Swap-API/1Click flow from any chain into the Umanity mainnet vault with the 50 bps integrator fee visible, dry quotes for all chains, refund handling (`refundTo`), status pill through SUCCESS/REFUNDED, explorer links; Intents Connect "execute on arrival" into the Anchor `donate` instruction demonstrated in dry mode, live if the program is deployed to mainnet. Bonus for multi-chain source coverage.
- x402: `/api/x402/verify-milestone` and `/api/x402/sponsor-dare` with a full 402 → pay → verify → deliver flow, a browser button and a Node agent script, receipts in the DB, attestation hash written on-chain, documented error handling (expired blockhash, insufficient funds, replay).
- Consumer app: instant demo wallet, no empty states, feed that feels alive, mobile layout, 2–4 minute video.

NEAR (submit by 14 Nov): same repository, plus `HACKATHON.md`-style README section with "do X, see Y" steps, NEAR Intents named explicitly as the settlement layer, optional NEAR AI Cloud signed inference for the oracle (Private AI track), a NEAR named account for payout, and a public demo post on X. Tracks: `realworld`, `agents`, `social`, `open`.

MultiHopper (by 30 Nov): devnet integration of the discreet route and milestone multi-send; production onboarding and the Telegram builder chat after 8 Nov.

## 7. Schedule (12 days to the Solana final)

| Day | Date | Deliverable |
|-----|------|-------------|
| 1 | Mon 27 Oct | Codebase audit, research, this blueprint, data layer, program v2, IDLs committed |
| 2 | Tue 28 Oct | API routes on the new data layer, app shell without wizard, instant demo wallet, deploy program v2 to devnet, seed real devnet state |
| 3 | Wed 29 Oct | Telemetry bar, cause cards, feed with dares, profile pass, right rail |
| 4 | Thu 30 Oct | Give & Bridge: 1Click/Aurora quotes, deposit address, status polling, intents in DB and feed |
| 5 | Fri 31 Oct | x402 oracle endpoints, browser payer, agent script, on-chain attestation |
| 6 | Sat 1 Nov | Governance end to end on-chain (campaigns, milestones, release), Blinks for dares, mobile pass |
| 7 | Sun 2 Nov | Checkpoint submission: deploy, README, draft video |
| 8–9 | 3–4 Nov | MultiHopper devnet route, Living Guardian art, polish, bug bash |
| 10 | 5 Nov | Mainnet vault + one real cross-chain donation on video |
| 11 | 6 Nov | Final video, README, HACKATHON-style steps, X post |
| 12 | 7–8 Nov | Buffer, submit |
| 13+ | 9–14 Nov | NEAR extras (NEAR AI Cloud attestation, named account), NEAR submission |

## 8. Things only you can do (please do these early)

1. Aurora Intents Studio key: sign up at https://studio.aurora.dev, create an app, set the fee to 50 bps, paste the key as `AURORA_API_KEY`. Without it the app still works through the public 1Click API (plus 25 bps).
2. NEAR Intents partner JWT (optional, removes the 25 bps surcharge and enables `appFees`): https://partners.near-intents.org. Needs a NEAR account for fee payout; the same named account goes on the NEAR hackathon submission form. Create one at https://wallet.near.org (Meteor or MyNearWallet), ideally `umanity.near`.
3. Mainnet funds for the cross-chain demo: roughly $10–20 of USDC on Base (or ETH/NEAR/anything supported) in a wallet you control, plus about 0.05 SOL on mainnet in the Umanity vault wallet for rent.
4. Decide on mainnet program deployment (about 2.4 SOL rent, reclaimable later by closing the program). Needed only for Intents Connect execute-on-arrival; the Swap-API flow does not need it.
5. MultiHopper developer key: connect a wallet at https://devnet.multihopper.com/developer/dashboard and paste the `mh_test_` key as `MULTIHOPPER_API_KEY`.
6. Devnet USDC for x402 demos: https://faucet.circle.com (20 USDC per 2 hours) to the demo wallet and treasury.
7. Server: the Ubuntu box with Docker (`docker compose up` brings Postgres + app + Caddy). Until then Vercel + a free Postgres (Neon or Supabase connection string) works with `DATABASE_URL`.
8. Field Fund: one real delivery (orphanage or animal rescue) filmed and receipted during the hackathon window is worth more than any feature. It gives the oracle real evidence and the video a real ending.
9. Keep `~/.config/solana/devnet.json` safe; it is the program upgrade authority and the pool authority. Back it up now.

## 9. Risks and how they are handled

- Mainnet-only intents: dry quotes everywhere, one small real transaction recorded on video, refunds handled via `refundTo`.
- Third-party outages during judging: all external calls have timeouts and the UI degrades to cached state; nothing ever shows "Failed to create user".
- Unverified client data: every donation signature is re-read from RPC before it counts.
- Scope: features are gated behind flags so an unfinished integration never ships half-broken.
- Legal: no lottery, no token, no yield promises. Donations are described as what they are.
