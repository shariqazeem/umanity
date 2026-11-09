# Umanity: the live mainnet demo (target 3:30, limit 4:00)

One take, with your face cam in a corner and the screen recorded at 1440p (browser zoom 100%, light mode) on https://umanity.gives. Everything in it is real: real USDC, real transactions, the first real drop. Speak plainly and let the screen prove each claim.

**Rehearsed on 9 Nov:** all three ways to give settled on mainnet (JUDGES.md, "Proof"). A gift from Ethereum takes about three minutes from send to pot, because Ethereum needs a couple of minutes to confirm. So the take sends it first and comes back for it at the end.

## Before you record (10 minutes)
1. Sign in on umanity.gives with your Umanity wallet. Each take spends **$2 USDC** from it: $1 in one tap, $1 from the agent.
2. In Phantom, keep **0.0005 ETH on Ethereum** for each take. The $1 gift is about 0.000478 ETH, and the gas costs less than a cent.
3. Open six tabs in this order: the landing, **Home**, **Drop #1**, **For agents**, **Trade**, **Money**.
4. Close everything else. Turn notifications off.

## 0:00–0:15 · Hook (face cam, landing)
"Crypto giving runs on trust: you send money and hope it arrives. I'm Shariq. Umanity puts every gift on camera, with the rules in a Solana program. It went live on mainnet today, and I'll give to our first real drop three ways, live."
> The landing: *Live on Solana Mainnet*, live totals.

## 0:15–0:50 · Send a gift from Ethereum (Aurora Intents)
> **Home** → the black circle → type **1** → **Or pay from 30+ chains** → **ETH · Ethereum** → paste your 0x address as the refund address → **Get my deposit address** → in Phantom, send exactly the amount shown.
"Most people don't hold USDC on Solana, so you can pay from 39 chains. Aurora Intents quotes exactly what to send so that one dollar lands in the pot. If the swap fails, NEAR Intents refunds me on Ethereum. Ethereum takes a few minutes to confirm, so I'll come back to it."
> Phantom warns that the address is new. That's expected: it's a one-off address made for this gift.
> **Leave the Home tab on this sheet.** While it's open, it checks the swap every 6 seconds and puts the money in the pot the moment it arrives.

## 0:50–1:20 · The drop (Drop #1)
"Every gift goes into a drop: one real delivery, with a shopping list, a place and a date. It has its own USDC pot, and the program owns it."
> Point at the shopping list (*checked against its on-chain hash*), the pot, the date, the four steps.
"The pot pays only after we film the delivery, hash the proof onto Solana, and a six-hour check passes. If we miss the date, the program refunds every backer. Nobody can send it anywhere else."

## 1:20–1:45 · Give in one tap (Consumer)
> **Give to this drop** → type **1** → **Give $1** → Touch ID.
"No SOL, no gas, no seed phrase. Umanity pays the network fee. One touch and it's in the pot, in my name."
> The success screen → **View transaction** → Solscan shows the `give`.

## 1:45–2:20 · An AI agent gives over x402
> **For agents** → $1 → **▶ Pay $1 into Drop #1 via x402**.
"Agents can give too, with one HTTP request. The API answers 402 Payment Required, the wallet signs a USDC transfer, PayAI settles it on mainnet, and the money goes into the pot with the agent as the backer. So a missed date refunds the agent."
> 402 → signed → settled → the receipt, verified in the browser.

## 2:20–2:55 · Where every dollar goes
> **Trade** → the $UMANITY card (price, how far the curve has filled, fees). Then **Money**: gifts, pots, fees split, and the rules with their addresses.
"Trading feeds the pots too. $UMANITY went live today, and only this program can claim its trading fees. In the first minute, sniping bots paid twenty-seven dollars in fees. The program sent half to the drops fund, and that half is already in Drop #1. Bots are paying for deliveries. Every dollar here is read from the chain."

## 2:55–3:15 · Back to the gift from Ethereum
> **Home** tab: *In the pot ✓* → **View transaction** → Solscan: the treasury's `give`, with my wallet as the backer.
"There it is: ETH sent on Ethereum, now one dollar of USDC in a Solana pot, in my name."

## 3:15–3:40 · What's next (face cam)
"Anyone can now propose a drop where they live, and it's paid only after its proof. Today Umanity's key signs the unlock. Next, that key moves to a NEAR contract that's already on NEAR mainnet. It only signs after an AI checks the filmed proof inside a secure enclave and a council has had time to say no. Proof on camera, refunds by code. Thanks!"

---

If something stalls live, say what's happening; the transactions are real. If the Home tab still says *Swapping* at 2:55, go straight to What's next and look back when it flips. If it hasn't landed by the end, add one labelled cut ("a minute later") to it landing. The rehearsal's gift from Ethereum is in JUDGES.md as backup.
