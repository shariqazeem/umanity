# Encode × Solana Hackathon 2026 — Umanity (copy for the submission form)

**Project:** Umanity
**One line:** Crypto giving, on camera. Every gift goes into a USDC pot for one real delivery; the pot pays out only after the delivery is filmed and proven on Solana, and refunds every backer by code if it isn't.

## Description
Crypto giving runs on trust: you send money to a wallet and never learn what happened to it. Umanity replaces trust with a Solana program. Money goes into **drops**: one real delivery each (a shopping list, a place, a date), with its own USDC pot owned by the program. The pot pays the drop's supplier only after the delivery is filmed, the proof bundle is hashed on-chain and a review window passes. If the drop misses its date, refunds open and every backer gets their own money back.

Giving takes one tap: sign in, create a wallet, press the black circle. Umanity pays the network fee, so nobody needs SOL. People can also give from 30+ other chains with Aurora Intents, and AI agents can give over x402, always with the giver as the backer, so refunds reach them. Trading in the app feeds the same pots: swaps carry a 0.5% fee that the program splits 50/50 between drops and running Umanity. A Money page traces every dollar from gift to payout or refund, read from the chain.

## How Solana powers it
- One Anchor program (`UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`, 18 instructions): pots are USDC accounts owned by each drop's PDA; proof is a sha256 posted on-chain; unlock needs a passed review window, must name the exact proof it pays for, and pays only the drop's fixed payee; refunds can only go to their backer; fees are split 50/50 by code.
- Sponsored transactions: the treasury co-signs as fee payer, so new users never need SOL.
- x402 on Solana: payment → settlement → `give` with the payer as backer → ed25519-signed receipt.
- Jupiter Swap V2 with the platform fee paid straight into the program's fee inbox.
- Aurora Intents: any-chain deposits settle as USDC on Solana and go into the pot with `give`.
- 7 program tests run against Meteora's real bonding-curve program cloned from mainnet.

## Tracks
- **Best Consumer App:** a clear everyday use (giving you can verify), one-tap onboarding with no SOL needed, and a working end-to-end flow on devnet.
- **Best Use of x402:** the payment is the gift. A drop that can't take it is refused before any 402; after settlement the agent's wallet becomes the backer, so a missed date refunds the agent. An MCP server lets Claude fill a drop with spend caps.
- **Aurora Intents:** removes the "I don't have USDC on Solana" friction. Exact-output quotes, a one-off deposit address, settlement into the pot in the giver's name, overflow returned in the same transaction, failed swaps refunded on the origin chain, and a settler that can never pay twice.

## Links
- Live demo: https://umanity.vercel.app (devnet; Drop #3 is a labelled demo, test USDC at faucet.circle.com)
- Code: https://github.com/shariqazeem/umanity (branch `mainnet`; README "Try it", JUDGES.md)
- Program: https://explorer.solana.com/address/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3?cluster=devnet
- Demo video: _(add the link)_
- Slides: https://claude.ai/artifact/GHsj6hVeko5e8dHLvgyWwd (share it from its Share menu first, so judges can open it)

## What existed before
An earlier Umanity (github.com/shariqazeem/umanity-social) won a Superteam bounty and the Solana Graveyard Hackathon's Tapestry track; it was a SOL tipping and cause app with different programs. This repository started fresh on 27 Oct 2026, and everything in it (the program, the drops app, x402 gifts, Aurora gifts, swaps and the token tooling) was written during the hackathon window.

**Team:** Shariq, solo founder (@umanity_xyz).
