# Umanity — giving is the content

**The social impact network on Solana.** Donations are escrowed in on-chain vaults, released only when the community votes that a milestone was delivered, audited by an AI Impact Oracle that anyone (or any agent) pays per request over x402, and fundable from 31+ chains through NEAR Intents. Two of the six causes are delivered in person by the Umanity team with receipts, photos and geotags posted as proof.

- Live app: https://umanity-solana.vercel.app
- Programs (Solana devnet): `umanity_donations` [`9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`](https://solscan.io/account/9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1?cluster=devnet) · `umanity_tips` [`DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`](https://solscan.io/account/DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau?cluster=devnet)
- Built by a solo founder: [@umanity_xyz](https://x.com/umanity_xyz) · [shariqazeem](https://github.com/shariqazeem)
- Hackathons: Encode x Solana 2026 (Aurora Intents, Best Consumer App, Best Use of x402), NEAR Hackathon 2026 (Real-World Money, Agent Economy, Social Money, Open Innovation), MultiHopper Build & Route Challenge

---

## The problem

Crypto charity failed twice: donation pages were one-way sinks with no proof of delivery, and "charity tokens" were speculation with no accountability. Donors cannot see where money went, 85% of them hold assets on other chains, and whales will not dox their main wallet on a public feed.

## What Umanity does

| Piece | How it works | Where it lives on-chain |
|---|---|---|
| **Escrowed causes** | Every donation goes to a cause's vault PDA, never a personal wallet. A `DonationRecord` PDA is created per gift. | `initialize_pool`, `donate`, `one_tap_donate` |
| **Milestone governance** | Each cause has a campaign with up to 5 milestones. When a milestone threshold is crossed a fund-release vote opens. Your voting power = impact points (1 SOL given = 1,000). A passed vote lets the authority call `release_milestone_funds`; the SOL moves from the vault PDA to the campaign recipient. Rejected = funds stay locked. | `create_campaign`, `init_milestone`, `approve_milestone`, `release_milestone_funds`, `claim_refund` |
| **AI Impact Oracle (x402)** | The charity or field team uploads delivery evidence. Anyone pays $0.01 USDC over HTTP 402 to run the audit; the verdict, confidence and per-check results come back and the attestation hash is written to the Milestone account. | `attest_milestone` |
| **Staked Impact Dares** | Lock SOL in a dare vault challenging someone to give. Friends boost the pot (in-app or straight from X via a Blink). Completed or expired, the pot ends in the cause's vault; 1.5% protocol fee enforced on-chain. | `create_dare`, `boost_dare`, `settle_dare` |
| **Give from any chain** | NEAR Intents (via Aurora Intents' 1Click API) quotes and routes ETH, Base USDC, BTC, TON, NEAR and 30+ other assets into the Umanity Solana vault with a 50 bps integrator fee. | mainnet settlement (see below) |
| **Discreet route** | Whale/Zakat donations routed through MultiHopper's TRM-screened multi-hop rail, shown in the feed as "anonymous". | MultiHopper program (devnet keys) |
| **Social layer** | Feed of donation stories with source-chain badges, likes, comments, follows, leaderboards, streaks and the evolving Living Guardian pass (Seed → Sprout → Bloom → Guardian → Sovereign). | off-chain index, every card links to its transaction |
| **Blinks** | One Solana Action per cause and per dare: donate or boost from any X timeline. | `/api/actions/donate/[poolId]`, `/api/actions/dare/[dareId]` |

Every number on screen is read from devnet or from transactions recorded after on-chain verification. There is no fake data. The seed script creates real devnet transactions.

---

## Try it in 5 minutes (do X → see Y)

No wallet needed. Everything below runs on Solana devnet.

1. Open the app → **see** the Feed with live dares (ticking countdowns), an open fund-release vote and donation stories, each with a Solscan link.
2. Click **⚡ demo wallet** (top right) → **see** a green `DEMO` pill with a fresh address and `0.25 SOL`. A browser-side keypair was generated and funded by the Umanity treasury on devnet.
3. Go to **Give & Bridge → Solana**, click the **0.01 SOL one-tap** card → **see** "0.05 SOL escrowed · +points · Bronze certificate" with a Solscan link, your balance drop, and the right-rail "Escrowed in vaults" number increase. (The server re-read the transaction from RPC before crediting you.)
4. Go to **Feed** → **see** your donation as a post. Like it, comment on it, click "Share Blink on X".
5. Go to **Causes** → **see** six vaults with the escrow bar (`locked / target · milestone n of 3`), the accepted-rails strip and three actions per cause.
6. Go to **Govern** → **see** the open proposal "Release milestone 1: Local Orphanage Aid" with the AI Impact Oracle panel. Click **Evidence** → **see** receipts, a geotagged photo and a video. Vote **Approve & release escrow** → **see** your voting power counted.
7. Click **Verify via x402 · $0.01** → with devnet USDC in your wallet **see** the oracle run, the verdict badge update and an `attestation sha256` line. Without USDC the toast explains what is missing. The same endpoint is callable by an agent: `npm run x402:agent -- <milestoneId>`.
8. Go to **Feed → ⚡ Launch a staked dare**, dare `@sol_impact` for 0.05 SOL with a 24h timer → **see** the dare card with a live pot and a "Boost pot" button, and the SOL locked in a dare vault PDA on Solscan.
9. Go to **Give & Bridge → Any chain**, pick Base / USDC / 10 → **see** a live NEAR Intents solver quote (amount out in SOL, time estimate, 50 bps integrator fee). Enter a refund address and click **Get deposit address** → **see** a one-time deposit address + QR and the status pill moving `Awaiting deposit → Swapping → Settled`. (Mainnet, real funds; see the note below.)
10. Go to **Profile & Pass** → **see** your Living Guardian card, streak, certificates, on-chain receipts and copyable Blinks.

---

## How Solana powers it

- Two Anchor programs (Rust, Anchor 0.31). `umanity_donations` v2 has 14 instructions: pools, PDA donation records (no throwaway signer, so Blinks and cross-chain execute-on-arrival can call it), campaigns, milestones with on-chain oracle attestations, escrow release via CPI transfers signed by the vault PDA, refunds, and staked dares.
- Every client-reported donation is verified server-side by re-reading the transaction and the vault's balance delta from RPC; amounts are never trusted from the browser.
- Solana Actions (Blinks) for every cause and every dare.
- x402 payments settle as SPL USDC transfers on Solana through the facilitator.
- The instant demo wallet is a real keypair signing real devnet transactions; nothing is simulated.

## Cross-chain: NEAR Intents / Aurora Intents

`lib/intents/oneclick.ts` talks to the NEAR Intents 1Click API (the engine behind Aurora Intents). With `AURORA_API_KEY` set it routes through Aurora's Swap API so the integrator fee configured in Intents Studio applies; otherwise it uses 1Click directly with `appFees` (50 bps).

- `GET /api/intents/tokens` – 37 chains / 200+ assets grouped for the picker
- `POST /api/intents/quote` – `dry: true` for free price previews, `dry: false` for a live quote with a one-time deposit address (tracked in the `intents` table)
- `GET /api/intents/status?id=` – polls the solver; on `SUCCESS` the donation is credited to the chosen cause and posted to the feed with a source-chain badge; `REFUNDED`/`FAILED` are surfaced with the refund path
- `POST /api/intents/deposit-submit` – optional tx-hash hint to speed up detection

**Important:** NEAR Intents has no testnet. Cross-chain donations settle on **Solana mainnet** into the Umanity cross-chain cause vault (`NEXT_PUBLIC_UMANITY_CROSSCHAIN_VAULT`) and are credited to the cause in the ledger. The escrow program runs on devnet during the hackathon; the v2 `donate` instruction is designed for Aurora Intents Connect "execute on arrival" (intermediary as signer, PDA record, no extra signers) and is wired up once the program is deployed to mainnet.

## x402 on Solana

Paid endpoints (x402 v2, `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers, scheme `exact`, USDC):

| Endpoint | Price | What you get |
|---|---|---|
| `POST /api/x402/verify-milestone {milestoneId}` | $0.01 | AI Impact Oracle audit: verdict, confidence, checks, attestation hash, on-chain attestation tx |
| `POST /api/x402/sponsor-dare {targetHandle, poolId, text}` | $0.05 | A sponsored Impact Dare (for agents and brands that hold USDC, not SOL) |
| `GET /api/x402/receipts` | free | Catalogue + recent settled receipts |

Flow: unpaid request → `402` with requirements (network `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`, devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, `payTo` treasury, facilitator fee payer) → client signs the USDC transfer → facilitator verifies → handler runs → settlement on Solana → `200` + `PAYMENT-RESPONSE` with the settlement signature.

Failure handling: payment is settled only after the handler returns 2xx (handler errors cancel the verified payment, nothing is charged); settlement failures return the facilitator's `errorReason`; expired blockhashes and insufficient funds surface as `402` with a fresh challenge; every attempt is recorded in `x402_receipts` with `verified | settled | failed`.

Verified on devnet during this build: settlement [`mavnKo4SF3TX9jQqwXuV9UVacPRtBSf2MzvYGehjphprvaFLyEoVuAdchsHi1E9ymUizGLYcbcepihnYzidaTom`](https://solscan.io/tx/mavnKo4SF3TX9jQqwXuV9UVacPRtBSf2MzvYGehjphprvaFLyEoVuAdchsHi1E9ymUizGLYcbcepihnYzidaTom?cluster=devnet) and the resulting on-chain attestation [`2KHdQugJ5d7gkGFgxYZZYnKN1TdvjUtDmFN15hV3PTCqxFsg8HX56emU3oTnby3oNrj7y6EVzpVhECWo2sLCMzwV`](https://solscan.io/tx/2KHdQugJ5d7gkGFgxYZZYnKN1TdvjUtDmFN15hV3PTCqxFsg8HX56emU3oTnby3oNrj7y6EVzpVhECWo2sLCMzwV?cluster=devnet).

Agent example (`scripts/x402-agent.ts`): a Node keypair with devnet USDC and no SOL pays for an audit using `@x402/fetch` + `@x402/svm`.

## MultiHopper (discreet route)

`lib/multihopper/client.ts` implements estimate → create → prepare → confirm → status against the MultiHopper self-service API (devnet with an `mh_test_` key, mainnet with `mh_live_`). The Give & Bridge terminal shows the hop preview and the 0.50% routing fee (0.25% Umanity integrator share). Without a key the UI still previews fees and the route.

## The Field Fund (real-world delivery)

Orphanage Aid and Street Animal Rescue are "field" causes: the Umanity team buys supplies and delivers them in person. Evidence (receipts, geotagged photos, video, content hashes) is uploaded per milestone (`POST /api/milestones/[id]/evidence`), audited by the oracle, hashed on-chain, and the release is voted on. A share of protocol revenue (dare fees, cross-chain fees, oracle fees, routing fees) funds these deliveries.

---

## Run it locally

```bash
git clone https://github.com/shariqazeem/umanity-social && cd umanity-social
npm install
cp .env.example .env.local          # defaults work on devnet with an embedded database
npm run dev                         # http://localhost:3000
```

Optional, to recreate the demo state on devnet with your own authority key (campaigns, donations, dares, evidence, a vote):

```bash
npm run seed
```

Requirements: Node 22. For the seed and for governance releases the server needs the pool authority keypair (`UMANITY_AUTHORITY_KEYPAIR` or `~/.config/solana/devnet.json` in dev). No database setup is needed locally (PGlite); set `DATABASE_URL` for Postgres in production.

Programs:

```bash
anchor build && anchor upgrade target/deploy/umanity_donations.so --program-id 9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1 --provider.cluster devnet
```

Deploy: `docker compose up -d --build` (Postgres + app + Caddy with automatic HTTPS; set `DOMAIN` and the keys in `.env`), or Vercel with a Postgres `DATABASE_URL`.

## Repository map

```
programs/risen-donations/src/lib.rs   Anchor program v2 (pools, PDA donations, campaigns, milestones, attestations, dares)
programs/risen-tips/src/lib.rs        tipping program
lib/db/schema.ts                      Drizzle schema (users, posts, follows, pools, donations, campaigns, milestones, proposals, votes, dares, intents, x402_receipts, ...)
lib/data/*                            data access (users, social, donations, governance, dares, intents)
lib/solana/*                          PDAs, instruction builders, chain readers/verifiers, authority ops, sync
lib/intents/oneclick.ts               NEAR Intents / Aurora Intents client
lib/x402/server.ts                    x402 resource server wrapper for Next.js routes
lib/oracle/impact-oracle.ts           AI Impact Oracle (NEAR AI Cloud / Claude / rule-based fallback)
lib/multihopper/client.ts             MultiHopper routing client
app/api/*                             46 API routes
components/*                          feed, causes, give & bridge, govern, profile, layout
scripts/seed-devnet.ts                real devnet seed · scripts/x402-agent.ts  autonomous payer
UMANITY_3_BLUEPRINT.md                product + engineering blueprint and the 12-day plan
```

## Honest status

- Working today on devnet: escrow donations, PDA records, campaigns and milestone releases, dares, x402-paid oracle with on-chain attestation, Blinks, feed/social, demo wallet, leaderboards, streaks.
- Working on mainnet: NEAR Intents quotes and deposit-address settlement into the Umanity vault (small real amounts).
- Preview only until keys/deployments land: Aurora Intents Connect execute-on-arrival (needs the program on mainnet), MultiHopper live routing (needs a key), NEAR AI Cloud signed inference for the oracle (needs a key; rule-based audit runs otherwise and says so).
- Not built on purpose: tokens, yield vaults and lotteries. Impact points are the unit until there is a real product reason to change that.

## Roadmap

Mainnet program deployment with Intents Connect execute-on-arrival · NEAR AI Cloud TEE-signed oracle attestations · Metaplex Core soulbound Guardian pass · MultiHopper multi-send supplier payouts after each release · charity partner onboarding with their own evidence uploads · wallet-signature auth and rate limits for public launch.
