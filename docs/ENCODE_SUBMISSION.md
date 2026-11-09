# Encode × Solana Hackathon 2026: Umanity (copy for the submission form)

**Project:** Umanity
**One line:** Crypto giving, on camera, live on Solana mainnet. Every gift goes into a USDC pot for one real delivery. The pot pays out only after the delivery is filmed and proven on Solana, and refunds every backer by code if it isn't.

## Description
Crypto giving runs on trust: you send money to a wallet and never learn what happened to it. Umanity replaces trust with a Solana program, and it's live on mainnet with real USDC.

Money goes into **drops**: one real delivery each (a shopping list, a place, a date), with its own USDC pot owned by the program. The pot pays the drop's supplier only after the delivery is filmed, the proof bundle is hashed on-chain and a review window passes. If the drop misses its date, refunds open and every backer gets their own money back.

Giving takes one tap. Create a wallet with Face ID, press the black circle, and it's in the pot. Umanity pays the network fee, so nobody needs SOL. People can also give from 39 other chains with Aurora Intents, and AI agents can give over x402. Either way the giver is the backer, so refunds reach them.

Trading in the app feeds the same pots: swaps carry a 0.5% fee that the program splits 50/50 between drops and running Umanity. A Money page traces every dollar from gift to payout or refund, read from the chain.

## How Solana powers it
- **One Anchor program** ([`UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3`](https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3), mainnet, 18 instructions):
  - pots are USDC accounts owned by each drop's PDA;
  - proof is a sha256 posted on-chain;
  - unlock needs a passed review window, must name the exact proof it pays for, and pays only the drop's fixed payee;
  - refunds can only go to their backer;
  - fees are split 50/50 by code.
- **Sponsored transactions:** the treasury co-signs as fee payer, so new users never need SOL.
- **x402 on Solana mainnet:** payment → settlement by PayAI → `give` with the payer as backer → ed25519-signed receipt.
- **Jupiter Swap V2,** with the platform fee paid straight into the program's fee inbox.
- **Aurora Intents:** any-chain deposits settle as USDC on Solana and go into the pot with `give`.
- **Tested before launch:** 7 program tests run against Meteora's real bonding-curve program cloned from mainnet. The mainnet deploy was rehearsed on a local validator with the real USDC mint, including closing the program and recovering its rent.

## Tracks
- **Best Consumer App:** a clear everyday use (giving you can verify), and one-tap onboarding with Face ID and no SOL. It works end to end on mainnet with the first real drop.
- **Best Use of x402:** the payment is the gift. A drop that can't take it is refused before any 402. After settlement the agent's wallet becomes the backer, so a missed date refunds the agent. Live on mainnet through PayAI, and an MCP server lets Claude fill a drop with spend caps.
- **Aurora Intents:** removes the "I don't have USDC on Solana" friction:
  - exact-output quotes from 216 assets on 39 chains, and a one-off deposit address;
  - settlement into the pot in the giver's name, with overflow returned in the same transaction;
  - failed swaps refunded on the origin chain, and a settler that can never pay twice.

  Demoed live on mainnet in the video.

## Links
- **Live app (Solana mainnet):** https://umanity-mainnet.vercel.app
- **Code:** https://github.com/shariqazeem/umanity (branch `mainnet`; README "Try it", JUDGES.md)
- **Program on mainnet:** https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3 (deploy: https://solscan.io/tx/2MrXvnCdxqVuGe2tDhztFZ4SQdH7abf9vd5Zdpbw3NMEdaVfxZ5hMV63zP6zYUjk6NvdWQP1SR5r5rjDGND34EZN)
- **Demo video:** _(add the link)_
- **Slides:** https://claude.ai/artifact/GHsj6hVeko5e8dHLvgyWwd (share it from its Share menu first, so judges can open it)

## What existed before
An earlier Umanity (github.com/shariqazeem/umanity-social) won a Superteam bounty and the Solana Graveyard Hackathon's Tapestry track; it was a SOL tipping and cause app with different programs. This repository started fresh on 27 Oct 2026. Everything in it was written during the hackathon window: the program, the drops app, x402 gifts, Aurora gifts, swaps and the mainnet launch.

**Team:** Shariq, solo founder (@umanity_xyz).
