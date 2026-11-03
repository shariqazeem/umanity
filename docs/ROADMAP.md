# Umanity roadmap

## Where it stands (28 Oct 2026)

- Original Umanity design system and app shell restored (the version that won Superteam and the Solana Graveyard Hackathon), rebuilt around giving from any chain and from agents.
- Escrow program v2.1 on devnet: vaults, milestones, attestations, dares, refunds, `donate_all` for execute-on-arrival; no withdraw path.
- Rails in: Solana wallet (one tap), Blinks, NEAR Intents / Aurora Intents (30+ chains), x402 (agents, MCP server).
- Proof out: field-team console with hashed media, Impact Oracle (paid per call over x402, verdict hash on-chain), donor votes, on-chain releases, a tracking page for every gift.

## Encode × Solana (checkpoint 2 Nov, final 8 Nov)

| Track | What judges should look at |
|---|---|
| Best Consumer App | One-tap gift (the black circle), *Follow your gift* tracker, social feed with dares and streaks, Guardian pass, share cards on X, works without a wallet to browse, installable on phones |
| Best Use of x402 | Give API where the payment is the gift; signed receipts; failure handling (`npm run x402:failures`); oracle audits and sponsored dares; MCP server so Claude can give |
| Aurora Intents | Live quotes for 30+ chains, deposit → swap → settle → escrow deposit, refunds and short deposits handled, reconcile cron, 50 bps fee |

Before the final: mainnet program deployment (≈3 SOL rent), Aurora organisation key, a $3–5 live cross-chain gift on mainnet, demo video, and the first real field delivery posted from the console.

## NEAR HACKATHON (1–14 Nov): "Solana holds the money; NEAR holds the rules"

Today a single Umanity key signs `approve_milestone`. The NEAR work makes that key powerless on its own. All of it is built from 1 Nov in new directories, on top of the 31 Oct tag.

1. **TEE oracle (NEAR AI Cloud).** The Impact Oracle runs on a NEAR AI model inside a TEE. Every audit stores the attestation report and the signed response, and each delivery card links to NEAR AI's public "Reply verified" page.
2. **Policy contract on NEAR (`release.umanity.near`).** It verifies the TEE signature against oracle keys the DAO registered, enforces per-cause caps, a veto window and replay protection, then asks `v1.signer` (Chain Signatures, ed25519) to sign a typed release message.
3. **`release_guard` in the Anchor program.** A release needs that MPC-signed authorization, checked through the Ed25519 precompile. The Umanity key alone can no longer approve.
4. **DAO (Trezu / Sputnik).** A treasury DAO owns the policy contract: it rotates oracle keys, changes caps, and can veto. Guardian-tier donors with a verified giving record join it.
5. **Tests that matter.** A tampered verdict fails; a release signed only by the founder fails; the steps run without secrets.

Tracks: AI Security & Defense (primary), Social Money, Privacy & Private AI.

## MultiHopper (Build & Route, to 30 Nov)

Only as a real feature: a *discreet gift* route that sends from the donor's wallet to a fresh gift wallet the donor controls, which then calls `donate`, so escrow accounting and refunds stay intact. The $100k volume bar needs a committed partner; Umanity will not cycle its own funds.

## The company

- **Model:** gifts carry no platform fee. Revenue comes from the rails: dare settlement fees (1.5%, on-chain), cross-chain integrator fees (50 bps), paid API calls over x402 (audits, sponsored dares, impact data for grant-makers), and later sponsored causes and Guardian perks.
- **Field operations:** the founder delivers in Karachi and interior Sindh, films it and posts it. Next: vetted field partners in other cities post deliveries from the same console and are paid from escrow on approval.
- **Growth loop:** every delivery is content on X, every gift and dare is a Blink or a share card, every gift page shows its own progress. Ramadan 2027 (Feb–Mar) is the first big season: zakat-eligible causes, a zakat calculator, and discreet giving.
- **Token:** not before the product has real deliveries and real donors. Points and the Guardian pass come first; if a token ever exists it must have a job (governance over releases, fee rebates), not be the product.
