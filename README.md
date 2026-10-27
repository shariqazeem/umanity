# Umanity — give to real people, watch it reach them

Umanity is a giving app on Solana for people who want to see where the money went. A gift waits in an on-chain escrow vault. The Umanity field team buys what is needed, delivers it in person in Pakistan, and posts the photos and receipts. An AI Impact Oracle audits the proof, the donors of that cause vote, and only then does the vault release the money. Anyone can give from any of 37 chains, dare a friend to match them, and carry a Living Guardian pass that grows with their giving.

- Repository: https://github.com/shariqazeem/umanity (the 3.0 rebuild; 2.0 won the Solana Graveyard track at the Tapestry hackathon and a Superteam bounty as [umanity-social](https://github.com/shariqazeem/umanity-social))
- Programs on Solana devnet, mainnet deployment in progress: `umanity_donations` [`9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1`](https://solscan.io/account/9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1?cluster=devnet) · `umanity_tips` [`DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau`](https://solscan.io/account/DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau?cluster=devnet)
- Built by a solo founder: [@umanity_xyz](https://x.com/umanity_xyz) · [shariqazeem](https://github.com/shariqazeem)
- Hackathons: Encode x Solana 2026 (Aurora Intents, Best Consumer App, Best Use of x402), NEAR "Build Beyond Boundaries" 2026 (Real-World Money, Social Money, Agent Economy), MultiHopper Build & Route Challenge

---

## The problem

Crypto charity failed twice. Donation pages were black holes: you sent money and got a thank-you email. Charity tokens were casinos: speculation with a cause stapled on. Meanwhile the people who would give hold their money on a dozen chains, and the organisations that could use it cannot prove, cheaply and publicly, that the money arrived.

Umanity's answer is to make the delivery the product. The gift is escrowed on-chain, the delivery is photographed and receipted, the proof is audited, and the donors themselves release the money. Every step leaves a record anyone can check.

## What you can do

| Screen | What happens |
|---|---|
| **Home** (`/home`) | A greeting, your streak and Guardian tier, a "Give today" strip of the six causes with progress toward the next delivery, and a stream of gifts, deliveries ("You helped fund this"), dares and release votes. |
| **Causes** (`/causes`, `/causes/[id]`) | Six causes with photography, what a gift buys ("$8 is a school kit"), the story, the delivery log with photos and receipts, the oracle verdict, the donor vote, the supporters, and the vault with every milestone and release. |
| **Give** (any screen) | USD-first presets labelled with what they buy, a Solana wallet or any other chain (USDC on Base, ETH, BTC, TON, NEAR and 200+ assets through NEAR Intents), anonymous giving, an optional private route. The server verifies the transaction on-chain before it counts. |
| **Profile** (`/profile`, `/u/[name]`) | The Living Guardian pass (Seed → Sprout → Bloom → Guardian → Sovereign), founding-giver status, your impact portfolio, streak, gifts, certificates, dares and posts. |
| **Transparency** (`/transparency`) | The public ledger: every vault's balance, every release with its transaction, every delivery, the fees that fund the Field Fund, the programs and wallets. |
| **Field team console** (`/admin`) | Where the team posts a delivery: cause, what was bought and for whom, amount in SOL and PKR, location, photos and receipts (hashed on upload), the milestone it fulfils, and whether to open the release vote. Donors of that cause are notified. Signed with the team's wallet. |
| **Blinks** (`/blinks`) | One Solana Action per cause and per dare, so a gift can happen inside a post on X. |

## How the money moves

```
you give  ──►  cause vault PDA (escrow)  ──►  delivery + proof posted  ──►  Impact Oracle audit (x402)
                                                   │                               │
                                                   ▼                               ▼
                                     donors of the cause vote ◄──── attestation hash on-chain
                                                   │
                                   approved ──►  release_milestone_funds  ──►  field team wallet ──► receipts
```

| Piece | How it works | On-chain |
|---|---|---|
| **Escrowed causes** | Each cause is a pool PDA with a system-owned vault PDA. A gift creates a `DonationRecord` PDA. Nobody can move the vault except through the program. | `initialize_pool`, `donate`, `one_tap_donate` |
| **Campaigns and milestones** | Every cause has a campaign with a target and three milestones (percentages of what was raised). A release vote opens when the team posts a delivery for a milestone, or when the raise crosses its threshold. | `create_campaign`, `init_milestone` |
| **Impact Oracle** | Delivery evidence (photos, receipts, hashes, location) is audited. The verdict, confidence and per-check results are returned and the attestation hash and confidence are written into the Milestone account. Rule-based by default; Anthropic or NEAR AI Cloud when keys are configured. | `attest_milestone` |
| **Donor vote** | Voting power = impact points (1 SOL given = 1,000). A passed vote lets the authority approve and release; a rejected vote keeps the money in the vault. The team can close a vote early with a signed request; it cannot vote. | `approve_milestone`, `release_milestone_funds`, `claim_refund` |
| **Dares** | Lock SOL to dare a friend to give. Friends boost the pot, in-app or from X. Completed or expired, the pot ends in the cause's vault with a 1.5% protocol fee enforced on-chain. | `create_dare`, `boost_dare`, `settle_dare` |
| **Any chain in** | NEAR Intents (Aurora Intents when a Studio key is set) quotes and routes any supported asset into the Umanity Solana vault with one deposit address. 50 bps integrator fee. Mainnet settlement; see below. | settlement tx on Solana |
| **Private route** | MultiHopper's TRM-screened multi-hop rail for donors who do not want their main wallet in a public feed. | MultiHopper program |

Every number on screen is read from the chain or from transactions the server re-verified. There is no seeded or placeholder data; a fresh deployment starts at zero.

---

## Try it in 5 minutes (do X → see Y)

The app runs on Solana devnet until the mainnet program deployment; the product is identical.

1. Open the app, press **Sign in → Create a Umanity wallet** → **see** a self-custodial wallet created in your browser (on devnet it is topped up by the treasury), then pick a name.
2. Press **Give**, choose a cause and **$5** → **see** "about 3 hot meals", the SOL amount, and your wallet marked Ready. Confirm → **see** "Thank you." with the on-chain link, points and a Bronze certificate. The server read the vault's balance change from RPC before crediting you.
3. Go to **Home** → **see** your gift at the top of the stream with a **Match** button for others, your streak started, and the "Give today" progress move.
4. Open the cause (`/causes/orphan-care`) → **see** the escrow numbers, what your gift buys, the vault with milestones ("opens at 6 SOL"), and the supporters wall with your name.
5. Open **Transparency** → **see** the vault table, releases with transactions, deliveries and fees, all live.
6. When the field team posts a delivery (the console at `/admin` is signed by the team wallet), every donor of that cause is notified and the card in Home shows **You helped fund this** with an **Approve release / Not yet** vote.
7. Press **Audit this proof · $0.01** on a delivery → **see** an HTTP 402 paid with one cent of USDC from your wallet, the oracle verdict with per-check marks, and the attestation hash. (Devnet USDC: faucet.circle.com.)
8. After the donors approve, the team presses **Release on-chain** → **see** the release transaction on the cause page, in the vault's milestone list and on Transparency.
9. Press **Dare a friend** on Home → **see** a staked dare with a countdown that friends can boost from the app or from X.

Verified on devnet on 27 Oct 2026 with this exact flow: gift [`5MD737…KGDb9`](https://solscan.io/tx/5MD737racDn3NMGuoGrCNzgVAPuPvwfvsJR6aQa2ZsReEHzt11hiejjJkb34kPBhm3ScoHM1ecR9ZcR7SqiKGDb9?cluster=devnet), x402 payment [`3cyBCC…xt6Te`](https://solscan.io/tx/3cyBCCJDQKtUwWUFHL3vPhfUur8xYMp2ywhPFk5pq28FVoJMZqHURKqhv44K6aNg597HgopT61qcXkh6JdYxt6Te?cluster=devnet), release from escrow after the vote [`5gq4rz…hfqw`](https://solscan.io/tx/5gq4rzTHE4zQjsU8n3gA5PG47rZseiCdMfZJzBcfSZfQfybJod9DzkUGfLodmkgoZCaj9yidLQvhDqLQzvfohfqw?cluster=devnet), on-chain attestation [`2KHdQu…MzwV`](https://solscan.io/tx/2KHdQugJ5d7gkGFgxYZZYnKN1TdvjUtDmFN15hV3PTCqxFsg8HX56emU3oTnby3oNrj7y6EVzpVhECWo2sLCMzwV?cluster=devnet).

---

## Solana

`programs/risen-donations/src/lib.rs` is an Anchor 0.31 program with 14 instructions. PDAs: pool `["pool", causeId]`, vault `["vault", pool]`, campaign `["campaign", pool]`, milestone `["milestone", campaign, index]`, donation record `["donation", pool, donor, nonce]`, dare `["dare", creator, nonce]`, dare vault `["dare_vault", dare]`. Vault debits are CPI transfers signed by the vault PDA. The authority can only approve and release a milestone; it cannot withdraw a vault to itself.

The app never trusts an amount from the browser. `POST /api/donate/sync` re-reads the transaction and uses the vault's balance delta. If recording fails after the transaction confirmed, the browser keeps the request and replays it (`lib/client/pending-sync.ts`).

Wallets: Wallet Standard (Phantom, Solflare, Backpack) or the Umanity wallet, a keypair created in the browser, backed up as a base58 secret and importable into any wallet.

## Cross-chain: NEAR Intents and Aurora Intents

`lib/intents/oneclick.ts` speaks the 1Click API; when `AURORA_API_KEY` is set it uses the Aurora Intents Swap API with the integrator fee configured in Aurora Studio. Dry quotes are free and keyless, so the Give sheet shows live solver pricing for every chain; a live quote returns a one-off deposit address, and `/api/intents/status` tracks it to the Solana settlement, which is recorded as a gift with a "from Base via NEAR Intents" badge. Intents have no testnet, so the cross-chain path settles on Solana mainnet into the Umanity vault wallet; execute-on-arrival into the program vault follows the mainnet deployment.

## x402 on Solana

`lib/x402/server.ts` wraps route handlers with `@x402/core` + `@x402/svm` (exact scheme, USDC, facilitator `x402.org`). Paid endpoints: `POST /api/x402/verify-milestone` ($0.01) runs the Impact Oracle and writes the attestation on-chain; `POST /api/x402/sponsor-dare` ($0.05). The browser pays with the same wallet it gives from (`lib/client/x402.ts`); an agent can pay with `npm run x402:agent -- <milestoneId> <baseUrl>`. Receipts are at `/api/x402/receipts`.

## MultiHopper

`lib/multihopper/client.ts` implements estimate → create → prepare → confirm → status against the MultiHopper API. The Give sheet exposes it as "Private route" with the fee preview; execution needs a MultiHopper key on the deployment.

## The Field Fund

All six causes are delivered in person by the Umanity team: orphan care, street animal rescue, family food packs, medical help, clean water and emergency relief, defined in `lib/causes.ts` with the units a gift buys and the milestone plan. The team's console uploads photos and receipts (SHA-256 on upload), attaches them to a milestone, opens the vote and notifies donors. Fees (1.5% on dares, 50 bps on cross-chain routing, x402 audits, private routing share) go to the treasury that funds deliveries.

## Revenue

| Stream | Where | Rate |
|---|---|---|
| Dare settlement fee | enforced in `settle_dare` | 1.5% of the pot |
| Cross-chain integrator fee | Aurora Studio / 1Click `appFees` | 50 bps |
| Paid oracle audits | x402 | $0.01 per audit, $0.05 per sponsored dare |
| Private routing share | MultiHopper integrator share | 0.25% |
| Gifts | none | 0% |

---

## Run it locally

```bash
npm install
cp .env.example .env.local      # devnet defaults; signers default to ~/.config/solana/devnet.json
npm run bootstrap               # creates the on-chain pools, campaigns and milestones (idempotent)
npm run dev                     # http://localhost:3000
```

Without `DATABASE_URL` the app uses an embedded PGlite database under `.data/` (one process at a time; stop the dev server before running scripts). Migrations in `drizzle/` apply on start.

## Deploy

**Ubuntu with Docker** (Postgres, app, Caddy with automatic HTTPS):

```bash
cp .env.example .env            # set the signers, DOMAIN and ADMIN_WALLETS; compose provides DATABASE_URL
docker compose up -d --build
```

**Vercel**: add a Postgres `DATABASE_URL` (Neon or Supabase), `UMANITY_AUTHORITY_KEYPAIR` and `UMANITY_TREASURY_KEYPAIR` as JSON arrays or base58, and an `S3_*` bucket for proof media (the local disk is ephemeral there).

**Mainnet**: deploy the program with the same program keypair (`anchor deploy --provider.cluster mainnet`), set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` and a production RPC, run `npm run bootstrap` (or press "Set up causes on-chain" in the field console), and point `X402_FACILITATOR_URL` at a mainnet facilitator.

## Repository map

```
programs/risen-donations/src/lib.rs   Anchor program (14 instructions)
lib/causes.ts                         the six causes: copy, units, images, milestone plan
lib/solana/                           PDAs, instruction builders, chain verification, authority ops, bootstrap
lib/db/schema.ts · drizzle/           Postgres schema and migrations
lib/data/                             users, social, donations, governance, dares, field updates, causes, transparency
lib/intents/ · lib/x402/ · lib/oracle/ · lib/multihopper/
lib/admin-auth.ts · lib/storage.ts    signed field-team requests, proof media storage
app/api/                              routes (donate/sync, causes, field/updates, governance/*, intents/*, x402/*, actions/*)
app/(marketing)/page.tsx              landing
app/(app)/                            home, causes, profile, transparency, how-it-works, admin, dares, blinks
components/                           give sheet, auth, feed, causes, profile, admin, shared primitives
scripts/bootstrap.ts · scripts/x402-agent.ts
```

## Honest status

- Program v2 and all app flows run on devnet; the mainnet program deployment is the next step (about 2.4 SOL of rent).
- Cross-chain giving settles on mainnet today into the vault wallet; execute-on-arrival into the program vault needs the mainnet program.
- The oracle is rule-based unless `ANTHROPIC_API_KEY` or `NEAR_AI_API_KEY` is set.
- MultiHopper execution needs an API key; the preview and fee estimate work without one.
- Proof media is stored on the server's disk by default; S3-compatible storage is wired behind env keys.

## Roadmap

Mainnet launch with the first field deliveries, persistent cross-chain deposit addresses per cause, execute-on-arrival through Intents Connect, oracle attestations signed in a TEE (NEAR AI Cloud), Field Fund council for Guardian-tier donors, native mobile.
