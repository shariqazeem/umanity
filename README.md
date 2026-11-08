# Umanity — Crypto giving, ~~on trust~~ on camera.

Umanity is the app where your crypto feeds people, on camera. Money goes into **drops**: one real delivery each (a shopping list, a place, a date), with its own **USDC pot on Solana**. The pot pays the drop's supplier only after the delivery is filmed and the proof has cleared a review window. If the drop misses its date, the program opens refunds and Umanity sends every backer their money back. Trading in the app feeds the same pots: every fee, from swaps or from the $UMANITY pool, is split 50/50 by the program between drops and running Umanity.

- **Repository:** https://github.com/shariqazeem/umanity (3.0). Earlier versions won a **Superteam bounty** and the **Solana Graveyard Hackathon (Tapestry track)** as [umanity-social](https://github.com/shariqazeem/umanity-social).
- **Program:** `umanity` [`UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`](programs/umanity/src/lib.rs) (Anchor 0.31, one program for pots, proof, refunds and fees)
- **Built by** a solo founder: [@umanity_xyz](https://x.com/umanity_xyz) · [shariqazeem](https://github.com/shariqazeem)
- **Entered in:** Encode × Solana Hackathon 2026 (Best Consumer App, Best Use of x402, Aurora Intents) · NEAR HACKATHON 2026 (work after the `pre-hackathon` tag)

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
7. **Open For agents → ▶ Pay into a drop via x402.** `POST /api/x402/give {drop, amountUsd}` → **402** → the wallet signs a USDC transfer → the facilitator settles → the treasury gives the same USDC into the pot **with the agent's wallet as the backer**, so a missed date refunds the agent → **200** with an ed25519-signed receipt verified in the browser.
8. **Team console (`/admin`, team wallets only).** Open a drop (description hashed on-chain), post updates, post proof (text, X post and every file's sha256, bundled and hashed onto Solana), unlock after review, call a drop off, refund everyone.

## Sponsor technology

### x402 on Solana (`lib/x402/server.ts`, `app/api/x402/give/route.ts`)
- The payment is the gift; the price is the request. A drop that cannot take the gift (closed, past its date, pot full) is refused with 400 before any 402, so an agent is never charged for it.
- After settlement the treasury calls `give` with `backer = the paying wallet`. Refunds go to the agent automatically if the drop misses its date.
- Receipts are ed25519-signed (`lib/receipt.ts`; signer published at `GET /api/x402/give`, which also lists the drops that are filling).
- **MCP server** (`mcp/server.ts`): `list_drops`, `get_drop`, `give`, with per-gift and per-session caps, so Claude can fill a drop for you.

### Aurora Intents / NEAR Intents (`lib/intents/*`)
- Live solver quotes from 30+ chains and deposit addresses. The planned v3 route settles into a pot: 1Click settles USDC on Solana, then `give`. With Intents Connect, `open_backer` + `give_all` give whatever arrived, because the amount is only known after the swap.

### Meteora Dynamic Bonding Curve (`lib/token/curve.ts`, `scripts/launch-umanity.ts`)
- $UMANITY: fixed 1B supply with no presale, no team tokens and no vesting. Part of the supply is sold on the curve; the rest seeds the DAMM v2 pool at graduation, and all of that pool's liquidity is permanently locked to the program's `fees` address. USDC quote, fee taken in USDC, and an anti-sniping fee that starts high and decays to 1% within a minute. The pool's fee claimer is that PDA, so only `sweep_meteora_fees` can claim. **Not launched yet**; `npx tsx scripts/launch-umanity.ts plan` prints the exact parameters.

### Jupiter (`lib/umanity/swap.ts`)
- Swap V2 `/build` with `platformFeeBps=50` and `feeAccount` = the program's fee inbox. Jupiter takes no share on `/build`. Every build is simulated before it is returned; sponsored builds are refused if they would cost the treasury more than one token account's rent.

### Keeper (`lib/umanity/keeper.ts`)
- From page reads, at most every 5 minutes: claim $UMANITY fees from Meteora and split them, split the fee inbox once it holds $1, and refund the backers of drops that missed their date.

## Run it locally

```bash
npm install
cp .env.example .env.local     # devnet defaults; signers default to ~/.config/solana/devnet.json
npm run dev                    # http://localhost:3000 (Turbopack)
```

Without `DATABASE_URL` the app uses an embedded PGlite database (one process at a time: never point a script at the data directory the dev server has open). Migrations in `drizzle/` apply on start.

- Program tests: `bash scripts/test-programs.sh`
- Set up a cluster: `npx tsx scripts/umanity-setup.ts init --ops <pubkey> [--release <pubkey>] [--max-pot 2000] [--review-hours 6]`
- Open a drop from a file: `npx tsx scripts/umanity-setup.ts drop meta.json --goal 750 --cap 900 --deadline 2026-11-20T18:00:00Z --payee <pubkey>` (or use `/admin`)
- Typecheck: `npm run typecheck`

The public devnet RPC rate-limits deploys and reads (HTTP 429). Set `NEXT_PUBLIC_SOLANA_RPC` to a dedicated endpoint. If a deploy stalls, `npx tsx scripts/resume-buffer.ts <BUFFER> target/deploy/umanity.so` fills only the missing chunks.

## Repository map

```
programs/umanity/src/lib.rs        pots, proof, unlock, refunds, fee split, Meteora fee sweep (18 instructions)
tests/umanity.test.ts              7 tests against a validator with Meteora DBC cloned from mainnet
lib/umanity/                       program client, indexer, drops data, feed, swaps, keeper, team actions, profiles
lib/token/curve.ts                 $UMANITY bonding curve settings
app/(app)/                         home, trade, give, money, profile, drops/[n], agents, admin
app/api/                           drops, feed, money, trade, x402, admin/drops, profile/drops
mcp/server.ts                      MCP server: Claude can fill a drop
scripts/                           test-programs.sh, umanity-setup.ts, launch-umanity.ts, resume-buffer.ts
```

## Honest status

- **Clusters:** the program is live on **devnet** ([`UmauiNG…`](https://explorer.solana.com/address/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3?cluster=devnet)), set up with a $2,000 cap per pot and a 6-hour review window. An x402 agent gift went into a labelled test drop's pot there ([tx](https://explorer.solana.com/tx/3yif3WLC51VXb1nqeQxd8DNN3gQVCv4Z7zjKKJLgxAfE6AS3dZJH5zNjsxofxSBtFfM5nh5xViV3xjpVrBx6A6UZ?cluster=devnet)), and the agent got its USDC back when the drop was called off. Every flow above is also verified on a local validator with Meteora's real program cloned from mainnet, and swaps by mainnet simulation. The mainnet deploy comes next.
- **Who can unlock a pot today:** the release key held by Umanity. It can only unlock a drop whose proof is on-chain and whose review window has passed, and only to that drop's payee; it cannot redirect or withdraw. During the NEAR hackathon unlocking moves behind a NEAR policy contract with Chain Signatures, and the release key can then be locked for good (`lock_release_authority`).
- **Umanity is a crypto app, not a registered charity.** Gifts are not tax-deductible. $UMANITY is not an investment and comes with no promise of returns.

MIT licence ([LICENSE](LICENSE)).
