# Umanity — demo video script (target 3:00)

Record at 1440p, light mode, browser zoom 110%. Pre-open the app, the Solscan tab, and the NEAR Intents explorer. Keep the demo wallet funded. Speak naturally; the script is a guide.

## 0:00 – 0:20 · Hook (face cam)

"Crypto charity failed twice. Donation pages were black holes, and charity tokens were casinos. I'm Shariq, and I built Umanity to fix both: every donation sits in an on-chain escrow on Solana, leaves only when the community votes that a milestone was delivered, and the proof is audited by an AI oracle you can pay per request. Giving is the content."

## 0:20 – 0:50 · Zero-friction entry + first donation

> Click ⚡ demo wallet. Point at the green DEMO pill.

"No wallet, no sign-up. A keypair is generated in the browser and funded with devnet SOL by our treasury. Real keys, real transactions."

> Give & Bridge → Solana → tap 0.01 SOL. Show the success card, click Solscan.

"One tap. The money is in the vault PDA, a DonationRecord was created, and the server re-read the transaction from RPC before giving me points and a Bronze certificate. Nothing here trusts the browser."

## 0:50 – 1:20 · The feed and a staked dare

> Feed. Scroll past dares and the vote card. Click Launch a staked dare → Create dare, dare @sol_impact for 0.05 SOL, 24h.

"The feed shows what people give, not what they say. And this is the social loop: I lock 0.05 SOL in a dare vault and challenge Sol to give too. Friends can boost the pot from inside the app or straight from X with a Blink. If Sol delivers, the pot goes to the cause. If he doesn't, the pot still goes to the cause. The cause never loses, and the 1.5% fee is enforced in the program."

> Click Boost pot on another dare. Show the pot increase and the Solscan link.

## 1:20 – 2:00 · Give from any chain (Aurora / NEAR Intents)

> Give & Bridge → Any chain. Base / USDC / 10. Show the live quote.

"Most donors don't hold SOL. With NEAR Intents, through Aurora, anyone can fund a cause from 37 chains: Base USDC, Ethereum, Bitcoin, TON, NEAR. This is a live solver quote: 10 USDC in, this much SOL out, a 50 basis-point integrator fee that becomes Umanity revenue."

> Paste the refund address, click Get deposit address. Show the QR, the explorer link, the status pill.

"One deposit address, no bridging, no wrapped tokens. When the solver settles on Solana the donation shows up in the feed with a 'from Base via NEAR Intents' badge." (If you pre-recorded a settled intent, cut to it here.)

## 2:00 – 2:40 · Govern + x402 oracle

> Govern. Open the orphanage proposal, click Evidence.

"This is a field cause: my team bought school supplies and clothing for 24 kids. Receipts, geotagged photos, a video, with content hashes."

> Click Verify via x402. Show the 402 → payment → verdict. Show the attestation hash and the on-chain tx.

"Verification is a paid API over x402. Any human or AI agent pays one cent in USDC per audit; the oracle returns a verdict with confidence and per-check results, and the attestation hash is written into the Milestone account on Solana. Then the community votes. Approve, and the authority releases escrow on-chain. Reject, and the money stays locked."

> Vote Approve. Show the tally.

## 2:40 – 3:00 · Profile + close (face cam)

> Profile & Pass. Show the Living Guardian card and the certificates.

"Your giving becomes an identity: a Living Guardian pass that evolves with streaks and votes, soulbound certificates, on-chain receipts, and Blinks you can share anywhere."

"Umanity: escrowed on Solana, released by vote, verified by an oracle, funded from any chain. Thank you."

## Checklist before recording

- Demo wallet funded (≥0.2 SOL) and holding devnet USDC for the x402 step (faucet.circle.com)
- `npm run seed` done so dares and a vote are live
- Aurora/1Click quote loads (needs internet, no key required)
- Keep the console closed; keep the right rail visible for live telemetry
