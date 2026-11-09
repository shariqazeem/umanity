# Encode × Solana Hackathon 2026: Umanity (copy for the submission form)

## Project description
Crypto giving, on camera, live on Solana mainnet. Every gift goes into a USDC pot for one real delivery. The pot pays out only after the delivery is filmed and proven on Solana, and refunds every backer by code if it isn't.

## Tracks
- Best Consumer App on Solana
- Best Use of x402 on Solana
- Aurora Intents: Bring any-chain liquidity to Solana

## Presentation
https://docs.google.com/presentation/d/1w3ntxyNXFjRDFRhAU5GXaDBTN68yh5c-rOe7fNWLJWQ/edit?usp=sharing

## Live demo video
https://youtu.be/45kQBtNDMBU

## Submission details

Umanity: crypto giving, on camera. Live on Solana mainnet with real USDC at https://umanity.gives

Crypto giving runs on trust: you send money to a wallet and never learn what happened to it. Umanity replaces that trust with a Solana program.

Money goes into drops: one real delivery each (a shopping list, a place, a date), with its own USDC pot owned by the program. The pot pays the drop's supplier only after the delivery is filmed, the proof bundle is hashed on-chain and a review window passes. If the drop misses its date, refunds open and every backer gets their own money back.

LIVE ON MAINNET TODAY
- Drop #1, ration packs for 5 families in Lahore (due 20 Nov), holds $19.49: $13.49 from $UMANITY trading fees and $6 from 6 real gifts by 2 backers.
- All three ways to give are proven with real money: one tap with a Touch ID wallet, ETH from Ethereum through Aurora Intents, and an AI agent over x402. Each was done on launch day and again live in the demo video, and every transaction is listed in JUDGES.md.
- $UMANITY trades on a Meteora bonding curve, and only the program can claim its fees. In its first minute, sniping bots paid $26.99 in anti-sniping fees. The program split it 50/50, and the drops fund's $13.49 is already in Drop #1.
- Anyone can propose a community drop where they live. The team reviews it, and the runner is paid only after proof.

HOW IT WORKS FOR A GIVER
Giving takes one tap: create a wallet with Face ID or Touch ID (no seed phrase, no extension), press the black circle, and it's in the pot. Umanity pays the network fee, so nobody needs SOL. You can also give from 216 assets on 39 chains with Aurora Intents, and AI agents can give over x402. Either way the giver is the backer, so refunds reach them. Gifts carry no fee. Trading in the app feeds the pots instead, and a Money page traces every dollar from gift or fee to payout or refund, read from the chain.

HOW SOLANA POWERS IT
- One Anchor program (UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3, mainnet, 18 instructions): pots are USDC accounts owned by each drop's PDA; proof is a sha256 posted on-chain; unlock needs a passed review window, must name the exact proof it pays for, and pays only the drop's fixed payee; refunds can only go to their backer; fees are split 50/50 by code.
- Sponsored transactions: the treasury co-signs as fee payer, so new users never need SOL.
- x402 on Solana mainnet: payment, settlement by PayAI, then give with the payer as the backer, and an ed25519-signed receipt.
- Jupiter Swap V2, with the platform fee paid straight into the program's fee inbox.
- $UMANITY on Meteora's Dynamic Bonding Curve (mint E8xJU7kAhKhDqnchrNfRKYTix7Hmgz8TBqX7QXCpNFka): the pool's fee claimer is the program's fees PDA, so sweep_meteora_fees claims trading fees by CPI and splits them in the same instruction. Fixed supply, no mint or freeze authority, no team tokens.
- Aurora Intents: any-chain deposits settle as USDC on Solana and go into the pot with give.
- Tested before launch: 7 program tests against Meteora's real bonding-curve program cloned from mainnet, and a full rehearsal of the mainnet deploy on a local validator with the real USDC mint, including closing the program and recovering its rent.

TRACKS
- Best Consumer App: an everyday use (giving you can verify), one-tap onboarding with Face ID or Touch ID and no SOL, a live feed, gift tickets you can follow to the delivery film, and community drops. It works end to end on mainnet with the first real drop.
- Best Use of x402: the payment is the gift. A drop that can't take it is refused before any 402. After settlement the agent's wallet becomes the backer, so a missed date refunds the agent. Live on mainnet through PayAI, with an MCP server that lets Claude fill a drop within spend caps.
- Aurora Intents: removes the "I don't have USDC on Solana" friction. Exact-output quotes from 216 assets on 39 chains and a one-off deposit address; settlement into the pot in the giver's name, with any overflow returned in the same transaction; failed swaps refunded on the origin chain; and a settler that can never pay twice. Settled for real on 9 Nov: 0.000477 ETH sent on Ethereum became exactly $1.00 in Drop #1's pot, in the giver's name, 2 min 40 s after the deposit, and again live in the demo video.

LINKS
- Live app (Solana mainnet): https://umanity.gives
- Demo video (3:55): https://youtu.be/45kQBtNDMBU
- Slides: https://docs.google.com/presentation/d/1w3ntxyNXFjRDFRhAU5GXaDBTN68yh5c-rOe7fNWLJWQ/edit?usp=sharing
- Code: https://github.com/shariqazeem/umanity/tree/mainnet (README "Try it", JUDGES.md)
- Every real gift with its transactions: https://github.com/shariqazeem/umanity/blob/mainnet/JUDGES.md
- Program on mainnet: https://solscan.io/account/UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3

WHAT EXISTED BEFORE
An earlier Umanity (github.com/shariqazeem/umanity-social) won a Superteam bounty and the Solana Graveyard Hackathon's Tapestry track; it was a SOL tipping and cause app with different programs. This repository started fresh on 27 Oct 2026, and everything in it was built during the hackathon: the program, the drops app, x402 gifts, Aurora gifts, swaps, $UMANITY and the mainnet launch.

Team: Shariq, solo founder (@umanity_xyz).
