# Umanity — demo video (target 3:00, limit 4:00)

Encode asks for a 2–4 minute video. Record the screen at 1440p, browser zoom 100%, light mode, on https://umanity.vercel.app. Speak plainly; let the screen prove each claim.

## Before you record (10 minutes)
1. Open the site, **Sign in → Create a Umanity wallet**. Open the wallet sheet and copy your address.
2. Go to [faucet.circle.com](https://faucet.circle.com), pick **Solana Devnet**, paste the address, get 10 test USDC.
3. Open **Drop #3** (the labelled devnet demo) in one tab and **For agents** in another.
4. Optional, for the Aurora track: only once mainnet is live, with a few USDC on Base in any wallet (record that part separately, see the end).

## 0:00 – 0:20 · Hook (landing page)
"Crypto giving runs on trust: you send money and hope. I'm Shariq, and Umanity puts every gift on camera, with the rules in a Solana program."
> Landing: *Crypto giving ~~on trust.~~ On camera.* Scroll once through **How a drop works**.

## 0:20 – 0:50 · What a drop is (Drop #3)
"Every gift goes into a drop: one real delivery, with a shopping list, a place and a date, and its own USDC pot owned by the program."
> Point at the pot, the four steps, the shopping list and *checked against its on-chain hash*.
"The pot only pays the drop's supplier after the delivery is filmed, its proof is hashed on Solana and a review window passes. If the date is missed, the program refunds every backer. This one is a labelled devnet demo, so it will be called off and refunded after judging."

## 0:50 – 1:40 · Give (Consumer App)
> Press **Give to this drop** → pick $2 → **Give $2** → approve.
"No SOL, no gas: Umanity pays the network fee. One tap and it's in the pot, in my name."
> Success screen → **View transaction** → Solana Explorer showing the `give` instruction.
"If you don't hold USDC on Solana, you can pay from 30 other chains with Aurora Intents. Here on devnet it shows live prices; on mainnet it settles straight into the pot."
> Back in the sheet: **Or pay from 30+ chains** → USDC on Base → the price appears. Close.

## 1:40 – 2:20 · An AI agent gives over x402
> **For agents** → amount $1 → **▶ Pay $1 into Drop #3 via x402**.
"Agents can give too. The API answers 402 Payment Required, the agent signs a USDC transfer, the facilitator settles it on Solana, and the treasury puts the same USDC into the pot with the agent's wallet as the backer. So if the drop misses its date, the agent gets refunded."
> Show 402 → signed → settled → the signed receipt verified in the browser.
"A gift the drop can't take is refused before any payment, so an agent is never charged for nothing."

## 2:20 – 2:45 · Where the money goes
> **Money** tab.
"Every dollar in and out, read from the program: gifts, pots, payouts, refunds."
> **Trade** tab.
"Trading feeds the pots too. Swaps carry a 0.5% fee that goes into the program, which splits every fee 50/50 between drops and running Umanity."

## 2:45 – 3:00 · Close
"Proof on camera, refunds by code, fees that feed people. Umanity is live on devnet today and goes to mainnet with its first real filmed delivery. Thanks!"

---

## Aurora track: separate 60–90 s clip (mainnet only)
1. On the mainnet site, open a drop → **Give** → $5 → **Or pay from 30+ chains** → **USDC · Base**.
2. "I hold USDC on Base, not Solana. Aurora Intents quotes exactly what to send so $5 lands in the pot."
3. Enter your Base address for refunds → **Get my deposit address** → send from your wallet.
4. Wait on the status: *Waiting for your deposit → Swapping → In the pot ✓* (about a minute).
5. **View transaction** on Solscan: the treasury's `give` into the drop's pot, with your Umanity wallet as the backer.
6. "If the swap had failed, NEAR Intents refunds me on Base. If the drop isn't delivered, the program refunds me on Solana."
