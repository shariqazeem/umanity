# Umanity — demo video (target 3:00, limit 4:00)

Record at 1440p, browser zoom 100%, light mode. Two browser profiles: a donor, and the field-team wallet for `/admin`. Keep a terminal open on the repo. Pre-fund the donor wallet with devnet SOL and a few devnet USDC (faucet.circle.com). Speak plainly; the screen does the proving.

## 0:00 – 0:20 · Hook (face cam, then the landing page)

"Every donation page is a black hole. You send money and you get an email. I'm Shariq, I deliver aid by hand in Karachi, and I built Umanity so you never have to take my word for it."

> Landing: the headline *Crypto giving ~~on trust.~~ On proof.* Scroll once through *How a gift moves*.

"Your gift waits in on-chain escrow until we deliver it, film it, and the donors vote to release it."

## 0:20 – 0:50 · One tap, then follow it (Consumer)

> Open the app → Sign in → Create a Umanity wallet. Give → press the black circle.

"No extension, no seed phrase to start. One tap: 0.01 SOL, about a dollar, goes into the orphan-care vault."

> *Gift confirmed* → **Follow your gift**.

"Every gift gets its own tracking page: given, locked in escrow, delivered, audited, voted, released. Each step is a transaction you can open."

## 0:50 – 1:25 · Give from any chain (Aurora Intents)

> Give → Give from another chain → Base · USDC · 25.

"Most crypto isn't on Solana. Here I give 25 USDC from Base. That's a live quote from the NEAR Intents solver network through Aurora: the cause receives about a quarter SOL in roughly thirty seconds, fee shown up front."

> Show the deposit address, QR, and the status steps. Cut to a completed one: *Settled* → *Deposited into the cause escrow*.

"When the solver pays out on Solana, the server deposits it into the cause's vault and credits the donor once, even if they closed the tab."

## 1:25 – 2:10 · Agents give too (x402)

> Agents → ▶ Pay $0.10 to Orphan care via x402. Let the console run.

"AI agents now hold money. This is the Give API. No account, no key: the server answers 402 with the price, my wallet signs a USDC transfer, the facilitator settles it on Solana, and the response is a receipt signed by the program authority. The console checks that signature right here."

> Terminal: `npm run x402:failures`.

"Bad requests are refused before anyone pays, and a replayed payment is rejected."

> Terminal: `npx tsx scripts/mcp-smoke.ts` (or Claude Desktop with the Umanity MCP server: "give a dollar to clean water and show me where it is").

"And Claude can do it in a conversation, with spending caps, and follow the gift afterwards."

## 2:10 – 2:45 · Proof and release

> Switch to the field-team profile → `/admin` → post a delivery with photos and a receipt, attach milestone 1, open the vote.

"When we deliver, I post it from this console. Photos and receipts are hashed on upload, and every donor of that cause is notified."

> Back as the donor → Govern → *Audit this proof · $0.01* → verdict → Approve release. Field team → Release on-chain → transaction.

"Anyone can pay a cent to have the oracle audit the proof, and its verdict is written on-chain. The donors vote. Only then does the program release that milestone, and only to the field team's registered wallet. There is no withdraw button."

## 2:45 – 3:00 · Close

> Ledger page, then the gift tracker now showing *Released*.

"Umanity: give from any wallet, any chain, or any agent, and watch it land. Crypto giving, on proof."
