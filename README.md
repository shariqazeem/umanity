# Umanity — Crypto giving, ~~on trust~~ on proof.

Umanity is a giving network on Solana where a donation is not a black hole. A gift (from a Solana wallet, from 30+ other chains through NEAR Intents, from a Blink on X, or from an AI agent over x402) lands in a program-owned escrow vault. The Umanity field team buys what is needed and hands it over in person in Pakistan, films it and uploads the receipts. An AI Impact Oracle audits the proof, the donors of that cause vote, and only then does the program release the money. Every step leaves a record anyone can check, and every gift has a page that follows it from the wallet to the hand-over.

- **Live demo:** https://umanity.vercel.app (Solana devnet; no wallet needed to browse)
- **Repository:** https://github.com/shariqazeem/umanity (3.0). Earlier versions won a **Superteam bounty** and the **Solana Graveyard Hackathon (Tapestry track)** as [umanity-social](https://github.com/shariqazeem/umanity-social).
- **Programs (Solana devnet):** `umanity_donations` [`9JBsHF…Kiys1`](https://solscan.io/account/9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1?cluster=devnet) · `umanity_tips` [`DBzVAJ…xtau`](https://solscan.io/account/DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau?cluster=devnet)
- **Built by** a solo founder in Karachi: [@umanity_xyz](https://x.com/umanity_xyz) · [shariqazeem](https://github.com/shariqazeem)
- **Entered in:** Encode × Solana Hackathon 2026 (Best Consumer App, Best Use of x402, Aurora Intents) · NEAR HACKATHON 2026 (work from 1 Nov is listed in [docs/ROADMAP.md](docs/ROADMAP.md))

---

## The problem

1. **Donations disappear.** You give, a wallet receives it, and you never learn whether anything was delivered.
2. **Crypto donors are stuck on other chains.** Most crypto sits on Base, Ethereum, Bitcoin or TON; bridging to give is a chore nobody does.
3. **Agents now hold money and have no way to give.** There is no charity API an AI agent can pay without an account.

## What Umanity does

```
give (wallet · any chain · Blink · agent)
   │
   ▼
cause vault PDA on Solana  ──  nobody can move it alone
   │
   ▼
field team delivers by hand, films it, uploads receipts (hashed on upload)
   │
   ▼
Impact Oracle audits the proof (paid per call over x402) → verdict hash written on-chain
   │
   ▼
the cause's donors vote → yes → release_milestone_funds → the money moves
```

---

## Try it (do X → see Y)

Everything below runs on Solana devnet. No wallet is needed to browse.

1. **Open `/home`.** See the original Umanity three-column app: live ticker, feed of gifts and deliveries, platform stats, top donors, recent activity. Totals (SOL given, gifts, escrow, released) are read from the program's own counters; the feed shows gifts the server re-verified on-chain. The live database started empty on 3 Nov 2026, so earlier devnet test gifts count in the totals but have no feed posts.
2. **Press Sign in → Create a Umanity wallet.** See a self-custodial wallet created in your browser (backup with the secret key; importable into Phantom). On devnet the treasury tops it up.
3. **Open Give → press the black circle (0.01 SOL).** See *Signing* → *Gift confirmed · +10 reward points*, with *Follow your gift →* and Solscan. The server re-read the transaction and recorded the vault's balance change; it never trusts an amount from the browser.
4. **Press Follow your gift.** See `/gift/<tx>`: six steps (Given → Locked in escrow → Delivered → Audited → Voted → Released), each with its transaction, the vault address, and the delivery it funds. A shared link unfurls on X as a progress card.
5. **Open Give → Give from another chain → Base · USDC · 25.** See a live NEAR Intents solver quote (on 28 Oct: "You send 25 USDC → cause receives ≈0.247 SOL, ~32 s"); the routing fee line appears once an Aurora key or a NEAR fee account is configured. Entering a refund address returns a real deposit address; the status tracks *pending → swapping → settled* and, on success, the server deposits the SOL into the cause's escrow (refunds and short deposits are shown as such).
6. **Open Agents → ▶ Pay $0.10 to Orphan care via x402.** See the real flow step by step: `POST /api/x402/give` → **402 Payment Required** (decoded `PAYMENT-REQUIRED`) → your wallet signs a USDC transfer → the facilitator settles on Solana → **200** with a receipt whose **ed25519 signature is verified in your browser**, plus a link to follow the gift. (Devnet USDC: [faucet.circle.com](https://faucet.circle.com).)
7. **In a terminal: `npm run x402:failures`.** See `400` for a bad body (never asked to pay) → `402` → `200` with the settlement tx → the same payment replayed is **refused**.
8. **Claude as a donor: `AGENT_KEYPAIR_PATH=~/.config/solana/devnet.json npx tsx scripts/mcp-smoke.ts`.** See the MCP server's tools, the live causes, a $0.12 gift paid over x402, "Receipt signature: valid", and the gift's journey. Add `mcp/server.ts` to Claude Desktop (snippet on `/agents`) to do the same in conversation.
9. **Open Govern.** See each delivery with its photos, the oracle verdict, *Audit this proof · $0.01* (another x402 call whose verdict hash is written on-chain with `attest_milestone`), the donor vote and the release transaction.
10. **Open Ledger (`/transparency`).** See every vault's balance, releases with their transactions, deliveries, fees collected, programs and wallets.

### Verified on devnet

| What | Transaction |
|---|---|
| Agent gift over x402: USDC settlement → escrow deposit (donate + memo) | [`4DvDCe…oSZrm`](https://solscan.io/tx/4DvDCebFCJt64s9cXhsNCKMHiwo3RQZ5ajs1itfh7UmwDteLq59gQQUtcrj1ChNxVuWCyexg5pAj2SVtVxfoSZrm?cluster=devnet) → [`2SeD4o…ezVZ`](https://solscan.io/tx/2SeD4o42myUDdnfrDvWh6imo6eNLXXSbdM8oXMH5jp658X4fTUzwwzjYF6CH5kE4Y3yyGHGRhYKDPsVRFKbqezVZ?cluster=devnet) |
| Gift made by Claude through the MCP server | [`5Ahayw…E87zX`](https://solscan.io/tx/5Ahaywhq4oD8J2V6k36xbBg41karrCgymEtc2M2GwLzrQmPfsi5vpCK1U6dpv4ibRJ8dmZqVRHv1MY3BfGVE87zX?cluster=devnet) → [`3ciY2r…WZoNQ`](https://solscan.io/tx/3ciY2r7MPzgZgn8x9tPPhT6RQhDyKxGaq7GhVJ8F9mYvLNVSAFWfMnHQLv3Uk7SwqtbAwxdiTby8Sa1LAeNWZoNQ?cluster=devnet) |
| Wallet gift into escrow | [`5MD737…KGDb9`](https://solscan.io/tx/5MD737racDn3NMGuoGrCNzgVAPuPvwfvsJR6aQa2ZsReEHzt11hiejjJkb34kPBhm3ScoHM1ecR9ZcR7SqiKGDb9?cluster=devnet) |
| Oracle audit paid over x402 | [`3cyBCC…xt6Te`](https://solscan.io/tx/3cyBCCJDQKtUwWUFHL3vPhfUur8xYMp2ywhPFk5pq28FVoJMZqHURKqhv44K6aNg597HgopT61qcXkh6JdYxt6Te?cluster=devnet) |
| Verdict hash written on-chain (`attest_milestone`) | [`2KHdQu…MzwV`](https://solscan.io/tx/2KHdQugJ5d7gkGFgxYZZYnKN1TdvjUtDmFN15hV3PTCqxFsg8HX56emU3oTnby3oNrj7y6EVzpVhECWo2sLCMzwV?cluster=devnet) |
| Escrow released after the donors approved (`release_milestone_funds`) | [`5gq4rz…hfqw`](https://solscan.io/tx/5gq4rzTHE4zQjsU8n3gA5PG47rZseiCdMfZJzBcfSZfQfybJod9DzkUGfLodmkgoZCaj9yidLQvhDqLQzvfohfqw?cluster=devnet) |
| Program upgraded to v2.1: withdraw path removed, `donate_all` added; the deployed bytes hash the same as `target/deploy` (sha256 `9b67b2a3…`) | [`46ntcJ…WK6W`](https://solscan.io/tx/46ntcJjcKshk2WrWRU8iLzQ1nRvfbXGhVjpqPpk5k215LFbcrVmh1kFjRiaytypGWsQa6Jvyi9ASZgHaDwFRWK6W?cluster=devnet) |
| A fresh account gives its whole balance with `donate_all` (what Intents Connect calls on arrival) | [`3dVnei…AacQM`](https://solscan.io/tx/3dVneidrfdu4HEq6r4JehqcrqtDp6YuyYSDD4zVMWQhk1L4v6X19AfxvT8AkghDTGL7v9Znq9Ax4kBhWds2AacQM?cluster=devnet) |

---

## How Solana powers it

- **Escrow is the program, not a promise.** `programs/risen-donations` (Anchor 0.31) keeps each cause in a pool PDA with a vault PDA. A gift writes a `DonationRecord` PDA. Vault debits are CPI transfers signed by the vault PDA, and there are exactly two ways out: `release_milestone_funds` (only to the campaign's registered recipient, only an approved milestone's share) and `claim_refund` (back to the donor after a missed deadline). v2.1, live on devnet, removed the old emergency `withdraw_from_pool`. The Anchor IDL is published on-chain, so Solana Explorer decodes every instruction by name.
- **Milestones and votes.** Each cause has a campaign with three milestones. Crossing a threshold or posting a delivery opens a release vote for that cause's donors (1 SOL given = 1,000 voting power).
- **Proof on-chain.** The oracle's verdict hash and confidence are written into the milestone account (`attest_milestone`).
- **Dares settle on-chain.** `create_dare`, `boost_dare`, `settle_dare`: the pot always ends in the cause vault, minus a 1.5% fee enforced by the program.
- **Blinks.** Every cause and every dare is a Solana Action (`/api/actions/donate/[cause]`, `/api/actions/dare/[id]`), so a gift can happen inside a post on X.
- **Payments.** x402 settles USDC on Solana; the NEAR Intents solver pays out SOL on Solana; both are deposited into the cause vault with `donate` and a memo that names the original payment.

## Sponsor technology

### x402 on Solana (`lib/x402/server.ts`, `app/api/x402/*`)
- **Give API** — `POST /api/x402/give {causeId, amountUsd, agent?}`. The 402 is priced by the request; the payment is the gift. After settlement the treasury deposits the SOL equivalent into the cause vault (`donate` + memo `umanity:x402:<settlement>:<payer>`), the gift is recorded, and the response is an **ed25519-signed receipt** (`lib/receipt.ts`, signer published at `GET /api/x402/give`) with a `/gift/<id>` tracking link.
- **Oracle audit** — `POST /api/x402/verify-milestone` ($0.01). The audit is computed before settlement and committed only after it.
- **Sponsored dare** — `POST /api/x402/sponsor-dare` ($0.05), credited to the wallet that signed the payment, never to an address in the body.
- **Failure handling** — invalid bodies get 400 before any 402; the payer and a replay key are read from the signed transfer; a replayed payment is refused (409 from our guard, or the facilitator rejects the spent transfer); a handler failure cancels the verified payment (never charged); facilitator outages answer 503 with `Retry-After`; a pending settlement answers 202. Facilitator: x402.org on devnet, PayAI on mainnet.
- **Agents** — `scripts/x402-give.ts` (agent with a keypair), `scripts/x402-failures.ts`, and an **MCP server** (`mcp/server.ts`: `list_causes`, `recent_deliveries`, `give`, `follow_gift`) with per-gift and per-session caps.

### Aurora Intents / NEAR Intents (`lib/intents/*`, `app/api/intents/*`)
- Live solver quotes for every supported chain and asset (keyless dry quotes), real deposit addresses, chain-aware deadlines, exact decimal amounts, the applied integrator fee (50 bps).
- Status tracking with *incomplete deposit* (shortfall and deadline), *refunded*, and retried *failed*; a reconcile route (`/api/intents/reconcile`, cron) credits gifts even if the donor closed the tab. Settlement is claimed atomically so a gift is credited once.
- With `AURORA_API_KEY` the same flow runs through Aurora's Swap API so the fee configured in the Aurora portal applies.
- `donate_all(nonce, keep)` gives an account's whole balance minus `keep` in one instruction, because the amount that arrives is only known after the swap. That is the call Intents Connect makes on arrival. `npx tsx scripts/donate-all.ts clean-water 0.02` runs it on devnet with a fresh account and books the gift through `/api/donate/sync`.

## Run it locally

```bash
npm install
cp .env.example .env.local      # devnet defaults; signers default to ~/.config/solana/devnet.json
npm run bootstrap               # pools, campaigns and milestones on-chain (idempotent)
npm run dev                     # http://localhost:3000  (Turbopack)
```

Without `DATABASE_URL` the app uses an embedded PGlite database under `.data/` (one process at a time; stop the dev server before running scripts). Migrations in `drizzle/` apply on start.

Useful scripts: `npm run x402:give -- clean-water 0.25 my-agent`, `npm run x402:failures`, `npm run mcp`, `npm run typecheck`.

The public devnet RPC rate-limits quickly (HTTP 429). For demos set `NEXT_PUBLIC_SOLANA_RPC` to a dedicated endpoint (a free Helius or Triton devnet URL).

## Deploy

- **Ubuntu + Docker** (Postgres, app, Caddy with HTTPS): `cp .env.example .env`, set the signers, `DOMAIN` and `ADMIN_WALLETS`, then `docker compose up -d --build`.
- **Vercel:** a Postgres `DATABASE_URL` (Neon or Supabase), `UMANITY_AUTHORITY_KEYPAIR` and `UMANITY_TREASURY_KEYPAIR` (JSON array or base58), `CRON_SECRET` (the cron in `vercel.json` calls `/api/intents/reconcile` daily, the most the Hobby plan allows), and a public Vercel Blob store connected to the project for proof media (`BLOB_READ_WRITE_TOKEN`). Run `npm run bootstrap` once with the production `DATABASE_URL` to mirror the chain into the new database.
- **Mainnet:** deploy the program with the same program keypair, set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` and a production RPC, run `npm run bootstrap`. The x402 facilitator switches to PayAI automatically. If `solana program deploy` stalls with "Max retries exceeded", the SOL stays in a half-written buffer: `npx tsx scripts/resume-buffer.ts <BUFFER>` fills only the missing chunks, then `solana program upgrade <BUFFER> <PROGRAM_ID>` finishes the deploy.

## Repository map

```
programs/risen-donations/src/lib.rs   escrow, milestones, attestations, dares (14 instructions)
programs/risen-tips/src/lib.rs        profiles and tips (4 instructions)
app/(marketing)/page.tsx              landing
app/(app)/                            feed, explore, give, govern, profile, agents, gift/[ref], causes/[id], dares/[id], blinks, transparency, admin
app/api/                              64 routes: donate/sync, x402/*, intents/*, gifts/[ref], field/updates, governance/*, actions/* (Blinks)
lib/x402/ · lib/receipt.ts            paid endpoints, signed receipts
lib/intents/                          NEAR Intents / Aurora client, settlement + reconciliation
lib/solana/                           PDAs, instruction builders, chain verification, escrow forwarding, authority ops
lib/data/                             users, social, donations, governance, dares, deliveries, gift journeys
mcp/server.ts                         MCP server: Claude can give and follow a gift
components/                           the original Umanity design system, rebuilt
```

## Honest status

- **Who approves a release today:** donor votes are tallied off-chain and `approve_milestone` is signed by the Umanity authority key. That key cannot withdraw or redirect funds (releases go only to the registered recipient, one milestone share at a time), but it is still a single key. During the NEAR hackathon this moves to a NEAR policy contract with Chain Signatures and a TEE-run oracle, so no single key can approve a release (see [docs/ROADMAP.md](docs/ROADMAP.md)).
- Programs and every flow above run on **devnet**. The mainnet program deployment (about 3 SOL of rent) is the next step; until then, a cross-chain gift settles on Solana mainnet and the devnet build credits the devnet escrow (the receipt says so).
- Agent and cross-chain value is forwarded into the vault by the treasury in the same request. Paying USDC straight into a program-owned vault needs a token-vault upgrade to the program (planned).
- The oracle is rule-based unless `ANTHROPIC_API_KEY` or `NEAR_AI_API_KEY` is set.
- Persistent per-donor deposit addresses (Aurora Intents Deposits) and Intents Connect execute-on-arrival need an Aurora organisation key and the mainnet program.
- MultiHopper discreet routing is not shipped; the client in `lib/multihopper/` is kept for a later, real integration.

## Business

Gifts carry no platform fee. Revenue comes from the rails around them: 1.5% on dare settlements (enforced on-chain), 50 bps on cross-chain gifts (integrator fee), paid API calls over x402 (audits, sponsored dares), and later sponsored causes and Guardian-tier perks. See [docs/ROADMAP.md](docs/ROADMAP.md).

MIT licence.
