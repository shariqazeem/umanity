# Umanity — Crypto giving, ~~on trust~~ on camera.

**Live on Solana mainnet: [umanity.gives](https://umanity.gives)** · [Demo video (3:55)](https://youtu.be/45kQBtNDMBU) · [For judges: every claim with its transaction](JUDGES.md) · [Slides](https://docs.google.com/presentation/d/1w3ntxyNXFjRDFRhAU5GXaDBTN68yh5c-rOe7fNWLJWQ/edit?usp=sharing)

Umanity is crypto giving you can verify. Money goes into **drops**: one real delivery each (a shopping list, a place, a date), with its own **USDC pot owned by a Solana program**. The pot pays the drop's supplier only after the delivery is filmed, its proof is hashed on-chain and a review window passes. If the drop misses its date, the program opens refunds and every backer gets their own money back. Gifts carry no fee. Trading in the app feeds the same pots: every swap fee and every $UMANITY trading fee is split 50/50 by the program between drops and running Umanity.

## Live on mainnet now

| What's live | Detail |
| --- | --- |
| **Real money in the first pot** | [Drop #1](https://umanity.gives/drops/1), ration packs for 5 families in Lahore due 20 Nov, holds **$19.49**: $13.49 from $UMANITY trading fees and $6 from 6 real gifts by 2 backers. |
| **Three ways to give, each proven** | One tap with a Touch ID wallet and no SOL, ETH from Ethereum through Aurora Intents, and an AI agent over x402. Every transaction is in [JUDGES.md](JUDGES.md). |
| **$UMANITY** | [`E8xJU7k…`](https://solscan.io/token/E8xJU7kAhKhDqnchrNfRKYTix7Hmgz8TBqX7QXCpNFka) on a Meteora bonding curve ([pool](https://solscan.io/account/EcKz44PtV27rpVQbThRACUUL3MhVTt9TYVBrdiNwivYc)) since 9 Nov. Fixed 1B supply, no mint or freeze authority, no team tokens, no presale. Only the program can claim its trading fees. Sniping bots paid $26.99 in its first minute; the program split it 50/50, and the drops fund's $13.49 is already in Drop #1. |
| **The program** | [`UmauiNG…`](https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3), 18 instructions, [deployed 9 Nov](https://solscan.io/tx/2MrXvnCdxqVuGe2tDhztFZ4SQdH7abf9vd5Zdpbw3NMEdaVfxZ5hMV63zP6zYUjk6NvdWQP1SR5r5rjDGND34EZN). The bytes on-chain match `target/deploy/umanity.so`. |
| **Community drops** | Anyone can propose a drop where they live at [/start](https://umanity.gives/start). The team reviews it, and the runner is paid only after proof. |
| **NEAR guard** | [`guard.umanity.near`](https://nearblocks.io/address/guard.umanity.near) is live on NEAR mainnet. It signs a pot's unlock with Chain Signatures only after an AI checks the proof inside a TEE on NEAR AI Cloud and a council has had time to veto. It takes over the unlock key next: [NEAR.md](NEAR.md). |

- **Repository:** https://github.com/shariqazeem/umanity (3.0). Earlier versions placed 3rd in a **Superteam bounty** (Nov 2025) and 3rd of 74 teams in the **Solana Graveyard Hackathon (Tapestry track)** (Mar 2026) as [umanity-social](https://github.com/shariqazeem/umanity-social).
- **Program source:** [`programs/umanity/src/lib.rs`](programs/umanity/src/lib.rs) (Anchor 0.31, one program for pots, proof, refunds and fees)
- **The plan:** [docs/PLAN.md](docs/PLAN.md): the flywheel, what $UMANITY is for, runners, films, and the rules that never change.
- **Built by** a solo founder: [@umanity_xyz](https://x.com/umanity_xyz) · [shariqazeem](https://github.com/shariqazeem)
- **Entered in:** Encode × Solana Hackathon 2026 (Best Consumer App, Best Use of x402, Aurora Intents) · NEAR HACKATHON 2026 (NEAR Intents gifts and the NEAR guard: see [NEAR.md](NEAR.md))
- **Built during the hackathons:** this repository started fresh on 27 Oct 2026. The earlier Umanity (umanity-social, above) was a SOL tipping and cause app with different programs. Everything here, the `umanity` program, the drops app, x402 gifts, Aurora any-chain gifts, swaps, $UMANITY and the mainnet launch, was built from 27 Oct on, during the hackathons.

---

## The problem

1. **Donations disappear.** You send money to a wallet and never learn whether anything was delivered.
2. **Refunds never happen.** When a delivery falls through, the money quietly stays where it is.
3. **Fees vanish into overhead.** Nobody can tell how much of a dollar reached anyone.
4. **Agents and other chains have no way in.** AI agents now hold money; most crypto sits off Solana.

## How a drop works

```
fill  (wallet · another chain · AI agent over x402 · fees from trading)
  │
  ▼
the drop's USDC pot ── an associated token account of the drop's PDA, owned by the program
  │
  ├─ delivered and filmed ─► proof bundle hashed on-chain (post_proof) ─► review window ─► unlock ─► the drop's payee only
  │
  └─ date missed / called off ─► refunds open ─► each backer gets their own amount back (anyone can send it; Umanity does)
```

One fee rule: **gifts go 100% to drops; every fee is split 50/50 by the program** (half to the drops fund, which can only pay into pots, half to Umanity).

```
Trade tab swap (Jupiter, 0.5% when USDC is one side) ─┐
$UMANITY pool trading fee (Meteora DBC, 1% in USDC) ──┼─► fee inbox (USDC account of the program's `fees` PDA)
                                                      │        │ split_fees / sweep_meteora_fees (permissionless)
                                                      │        ▼
                                                      └──► 50% drops fund ─► fund_drop ─► pots      50% ops
```

---

## The program (`programs/umanity/src/lib.rs`)

18 instructions. The rules a backer relies on are enforced here, not in the app:

| Area | Instructions | What the code guarantees |
|---|---|---|
| Setup | `init_config`, `set_admin`, `set_params`, `set_release_authority`, `lock_release_authority` | Only the program's upgrade authority can set it up. The unlock key can be handed over and then locked for good. Per-pot cap and review window are bounded. |
| Drops | `create_drop`, `cancel_drop` | A drop fixes its payee, goal, cap, date (at most 120 days) and the sha256 of its description. |
| Gifts | `give`, `open_backer`, `give_all` | Gifts are USDC into the drop's pot, capped. A backer record holds each backer's amount; the payer of a sponsored gift can differ from the backer. |
| Proof and payout | `post_proof`, `unlock` | Proof must be posted before the date; posting again replaces it and restarts the review window. `unlock` needs the release key and a passed review, must name the proof it was approved for (it fails if that proof was replaced), and pays the whole pot to the drop's payee only. |
| Refunds | `refund`, `return_to_fund`, `close_backer` | Refunds open when a drop is called off, misses its date unproven, or is not unlocked within 7 days after its date. Anyone may send a refund; it can only go to that backer's own USDC account. |
| Fees | `fund_drop`, `split_fees`, `sweep_meteora_fees` | Fees are split ops = ⌊half⌋, drops = the rest. The drops fund can only pay into pots. `sweep_meteora_fees` claims $UMANITY's Meteora DBC trading fees by CPI, with the `fees` PDA as the pool's fee claimer, and splits them in the same instruction. |

Events (`Gave`, `ProofPosted`, `Unlocked`, `Refunded`, `FeesSplit`, `MeteoraFeesClaimed`, …) are indexed into the database by `lib/umanity/indexer.ts`; the Money tab reads every total back from the chain.

**Tests:** `bash scripts/test-programs.sh` starts a local validator that clones Meteora's Dynamic Bonding Curve and Metaplex from mainnet, loads the program and runs 7 tests: setup only by the upgrade authority; caps and dates; fill → proof → review → unlock to the payee only (an unlock approved for replaced proof fails); the 50/50 split, the fund paying into pots and refunds after a cancel; refunds after a missed date; a real $UMANITY DBC pool whose trading fees a stranger sweeps into the program (and an attack that points the inbox elsewhere fails); handing over and locking the unlock key.

## Try it (do X → see Y)

1. **Open `/`.** See the landing page with live totals read from the program.
2. **Open `/home`.** See the next drop with the black circle, and a feed of what happened to drops: gifts, filmed proof, unlocks, fee splits, missed dates. Each card links its transaction.
3. **Sign in → Create a Umanity wallet → press the black circle.** Pick an amount in units ("1 ration pack, 5 people helped"), sign once. Umanity pays the network fee and the backer record's rent (`/api/drops/[id]/give`: the treasury signs the exact message first, so a giver cannot change it).
4. **Open the drop page.** See the pot, the four steps with a transaction each, the shopping list, backers, the description checked against its on-chain hash, and the proof checked against `post_proof`.
5. **Open Money.** See gifts → pots → unlocked / refunded, fees → split → drops fund / Umanity, every move with its transaction, and where each rule lives on-chain.
6. **Open Trade.** Live Jupiter routes with Umanity's 0.5% fee shown as dollars to drops. On mainnet the swap is built with Jupiter Swap V2 `/build`, and the fee goes in the same transaction into the program's fee inbox. Wallets without SOL get the network fee paid, a few swaps a day.
7. **Give from another chain.** In the give sheet, **Or pay from 30+ chains** → pick what you hold (USDC on Base, ETH, BTC, NEAR…) → see the exact price → get a one-off deposit address → send → the status follows it from deposit to swap to **in the pot**, with the Solana transaction. (On a devnet copy the sheet shows prices only: NEAR Intents has no test network.)
8. **Open For agents → ▶ Pay into a drop via x402.** `POST /api/x402/give {drop, amountUsd}` → **402** → the wallet signs a USDC transfer → the facilitator settles → the treasury gives the same USDC into the pot **with the agent's wallet as the backer**, so a missed date refunds the agent → **200** with an ed25519-signed receipt verified in the browser.
9. **Team console (`/admin`, team wallets only).** Open a drop (description hashed on-chain), post updates, post proof (text, X post and every file's sha256, bundled and hashed onto Solana), unlock after review, call a drop off, refund everyone.

## Sponsor technology

### x402 on Solana (`lib/x402/server.ts`, `app/api/x402/give/route.ts`)
- The payment is the gift; the price is the request. A drop that cannot take the gift (closed, past its date, pot full) is refused with 400 before any 402, so an agent is never charged for it.
- After settlement the treasury calls `give` with `backer = the paying wallet`. Refunds go to the agent automatically if the drop misses its date.
- Receipts are ed25519-signed (`lib/receipt.ts`; signer published at `GET /api/x402/give`, which also lists the drops that are filling).
- **MCP server** (`mcp/server.ts`): `list_drops`, `get_drop`, `give`, with per-gift and per-session caps, so Claude can fill a drop for you.

### Aurora Intents (`lib/umanity/intents.ts`, `components/drops/AnyChainGive.tsx`)
- **The friction it removes:** a drop takes USDC on Solana, but most people hold money elsewhere. The give sheet's "pay from another chain" uses the Swap API (1Click on NEAR Intents) to take any of 200+ assets on 30+ chains.
- **Exact-output quotes:** the giver asks for $30 in the pot; the quote says what to send (`POST /api/drops/[id]/intents`). A live quote opens a one-off deposit address (QR, optional memo, expiry).
- **Settlement into the pot:** the solver delivers USDC to Umanity's treasury on Solana; the treasury then calls `give` into the drop's pot **with the giver's Umanity wallet as the backer**, so a missed date refunds them like any other gift. If the pot filled or closed while the swap ran, what no longer fits goes to the giver's own USDC account in the same transaction.
- **Refunds and retries:** a failed swap is refunded on the origin chain by NEAR Intents; an incomplete deposit is shown with what's missing. The settling transaction's signature is stored before it is sent and one ref lock allows a single settler, so the browser's polling (`GET /api/drops/intents/[intent]`), the keeper and the daily cron can never pay twice.
- **Fees:** with an Aurora API key the request goes through Aurora's proxy and the integrator fee set in Aurora Studio applies; the sheet shows only the fee really charged. Program support for contract-level composability is ready (`open_backer` + `give_all` give whatever arrived) for Intents Connect.

### Meteora Dynamic Bonding Curve (`lib/token/curve.ts`, `scripts/launch-umanity.ts`)
- $UMANITY: fixed 1B supply with no presale, no team tokens and no vesting. Part of the supply is sold on the curve; the rest seeds the DAMM v2 pool at graduation, and all of that pool's liquidity is permanently locked to the program's `fees` address. USDC quote, fee taken in USDC, and an anti-sniping fee that starts high and decays to 1% within a minute. The pool's fee claimer is that PDA, so only `sweep_meteora_fees` can claim. **Live on mainnet since 9 Nov 2026** (mint [`E8xJU7k…`](https://solscan.io/token/E8xJU7kAhKhDqnchrNfRKYTix7Hmgz8TBqX7QXCpNFka)); `npx tsx scripts/launch-umanity.ts plan` prints its exact parameters.

### Jupiter (`lib/umanity/swap.ts`)
- Swap V2 `/build` with `platformFeeBps=50` and `feeAccount` = the program's fee inbox. Jupiter takes no share on `/build`. Every build is simulated before it is returned; sponsored builds are refused if they would cost the treasury more than one token account's rent.

### Keeper (`lib/umanity/keeper.ts`)
- From page reads (at most every 5 minutes) and a daily cron (`/api/keeper`): claim $UMANITY fees from Meteora and split them, split the fee inbox once it holds $1, refund the backers of drops that missed their date, and settle cross-chain gifts whose givers closed the tab. The cron also moves guarded drops along: it checks new proofs and releases approved ones.

### The NEAR guard (`near/guard/`, `lib/near/`): see [NEAR.md](NEAR.md)
- The key that unlocks a pot is a key only a NEAR contract can use, through Chain Signatures. The guard signs an unlock only after two things. First, an AI inside a TEE (NEAR AI Cloud) checks the proof against the promise, and the guard verifies the TEE's signature on-chain. Second, a council the owner cannot change gets a review window to veto. Even then, the only thing it signs is that one unlock.
- Live on NEAR mainnet (`guard.umanity.near`, on NEAR's `v1.signer`) and testnet (`guard.umanity.testnet`). Verified end to end on testnet: NEAR's MPC network signed a real Umanity unlock that a Solana validator accepted.

## Run it locally

```bash
npm install
cp .env.example .env.local     # devnet defaults; signers default to ~/.config/solana/devnet.json
npm run dev                    # http://localhost:3000 (Turbopack)
```

Without `DATABASE_URL` the app uses an embedded PGlite database (one process at a time: never point a script at the data directory the dev server has open). Migrations in `drizzle/` apply on start.

- Program tests: `bash scripts/test-programs.sh`
- Deploy and set up a cluster the way mainnet was: `OPS=<wallet> bash scripts/mainnet-deploy.sh` (keys outside the repo; resumable; rehearse with `RPC=http://127.0.0.1:8899`)
- Set up a cluster by hand: `npx tsx scripts/umanity-setup.ts init --ops <pubkey> [--release <pubkey>] [--max-pot 2000] [--review-hours 6]`, then `set-admin` and `accounts`
- Open a drop from a file: `npx tsx scripts/umanity-setup.ts drop meta.json --goal 750 --cap 900 --deadline 2026-11-20T18:00:00Z --payee <pubkey>` (or use `/admin`)
- Typecheck: `npm run typecheck`

Public RPCs rate-limit deploys and reads (HTTP 429). Put a dedicated endpoint with its key in `SOLANA_RPC_URL` (server only), and set `NEXT_PUBLIC_SOLANA_RPC_PROXY=1` so browsers go through `/api/rpc` and the key never reaches the page. If a deploy stalls, `npx tsx scripts/resume-buffer.ts <BUFFER> target/deploy/umanity.so` fills only the missing chunks.

## Repository map

```
programs/umanity/src/lib.rs        pots, proof, unlock, refunds, fee split, Meteora fee sweep (18 instructions)
tests/umanity.test.ts              7 tests against a validator with Meteora DBC cloned from mainnet
lib/umanity/                       program client, indexer, drops data, feed, swaps, cross-chain gifts, keeper, team actions, profiles
lib/token/curve.ts                 $UMANITY bonding curve settings
app/(app)/                         home, trade, give, money, profile, drops/[n], agents, admin
app/api/                           drops (+ intents), feed, money, trade, x402, keeper, admin/drops, profile/drops
mcp/server.ts                      MCP server: Claude can fill a drop
near/guard/                        the NEAR guard contract: TEE verdicts, council, Solana message checker, Chain Signatures (39 tests)
lib/near/                          the guard's server side: NEAR AI check, verdicts, guarded release
scripts/                           test-programs.sh, mainnet-deploy.sh, umanity-setup.ts, admin.ts, guard-setup.ts, guard-e2e.sh, near-attest.ts, launch-umanity.ts, resume-buffer.ts
```

## Honest status

- **Mainnet (since 9 Nov 2026):** the program runs on Solana mainnet ([`UmauiNG…`](https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3)) with real USDC, a $2,000 cap per pot and a 6-hour review after proof. The deploy was rehearsed first on a local validator with the real USDC mint, including closing the program and getting its rent back. Before that, every flow ran on devnet and on a local validator with Meteora's real program cloned from mainnet.
- **Who can unlock a pot today:** Umanity's release key. It can only unlock a drop whose proof is on-chain and whose review window has passed, and only to that drop's payee; it cannot redirect or withdraw. The NEAR guard that replaces it is deployed on NEAR mainnet and set up ([NEAR.md](NEAR.md)). The key moves to the guard after its first live AI check passes on mainnet, and is then locked for good (`lock_release_authority`). Until then, Umanity does not claim that nobody can move a pot alone.
- **Upgrades:** Umanity still holds the program's upgrade key, so fixes can ship. That is trust too; it moves to a multisig later.
- **$UMANITY** launched on 9 Nov 2026 with `scripts/launch-umanity.ts`, rehearsed first on a local validator.
  - Its metadata (name and logo) can still be updated by Umanity's key, but the supply is fixed.
  - After the curve graduates (about $49k in), the locked pool's fees need one more program instruction to claim.
  - $UMANITY is not an investment and comes with no promise of returns.
- **Umanity is a crypto app, not a registered charity.** Gifts are not tax-deductible.

MIT licence ([LICENSE](LICENSE)).
