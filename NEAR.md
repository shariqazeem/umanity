# Umanity on NEAR: gifts from any chain come in, and a NEAR guard decides when they go out

Built for **NEAR HACKATHON** (November 2026). Live app: https://umanity.gives · [Demo video](https://youtu.be/45kQBtNDMBU) · Tracks: **Real-World Money** and **AI Security & Defense**

## In one minute

- **The problem:** when you give online, you never learn what your money bought, and if the delivery falls through, the money doesn't come back.
- **Umanity:** every gift goes into a USDC pot on Solana for one real delivery (a shopping list, a place, a date). The pot pays the team only after proof of the delivery is posted on-chain, and refunds every giver by code if the date passes. Live on Solana mainnet with real money since 9 Nov 2026.
- **NEAR does two jobs:**
  1. **Money in, from any chain. Live on mainnet.** A gift can start as ETH on Ethereum, USDC on Base, BTC, NEAR or any of 190+ assets on 35+ chains. NEAR Intents turns it into exactly the USDC the giver asked for, and the program records the giver as the backer, so a refund goes back to them. The first real gift went from Ethereum to a Solana pot in 2 min 40 s.
  2. **Money out, only by the rules. Deployed on NEAR mainnet; proven end to end on NEAR testnet.** One decision was still a single key: who may press "unlock". The guard takes that key away from people. The pot's release key becomes a key that only a NEAR contract can use, through Chain Signatures, and the contract signs an unlock only after:
     1. an AI has checked the proof against the promise inside a TEE (NEAR AI Cloud), and the contract has verified the TEE's signature;
     2. a council the owner cannot change has had a review window to veto.

     The contract will sign nothing but that one unlock.
- **Not done yet:** the Solana mainnet program still takes unlocks from Umanity's key. That key moves to the guard after the first live AI check on a mainnet proof, and is then locked for good ([Honest status](#honest-status)).

## Check it yourself: five commands, no wallet, no keys

Each command reads live data and should print what this file says. They need `curl` and `jq`; the last one needs Rust.

1. **What a giver can pay with**, live from Aurora's Swap API on NEAR Intents:

   ```bash
   curl -s https://umanity.gives/api/intents/tokens | jq -c '{chainCount, tokenCount, feeBps}'
   ```

   On 13 Nov 2026 this printed `{"chainCount":39,"tokenCount":230,"feeBps":0}`, and at other moments that day 37 chains and 192 assets: the list comes from Aurora and changes. `feeBps` 0 means Umanity takes no fee on a gift.

2. **A free price for $1 from ETH on Ethereum into Drop #1** (drop `0` on-chain). Without `"live": true`, no deposit address is opened and nothing is stored:

   ```bash
   curl -s -X POST https://umanity.gives/api/drops/0/intents -H 'content-type: application/json' \
     -d '{"originAsset":"nep141:eth.omft.near","amountUsd":1}' \
     | jq -c '.quote | {live, depositAddress, send: .amountInFormatted, asset: .asset.symbol, chain: .asset.chainLabel, feeBps}'
   ```

   Expect `"live":false`, `"depositAddress":null`, about `0.0005` ETH to send (it moves with the price of ETH) and `"feeBps":0`.

3. **The first real gift, as NEAR Intents recorded it** (9 Nov 2026):

   ```bash
   curl -s "https://1click.chaindefuser.com/v0/status?depositAddress=0xe85063366530C04ECFCA00a7e07ed6a94Ef34EC9" \
     | jq -c '{status, deposited: .swapDetails.depositedAmountFormatted, usdc_out: .swapDetails.amountOutFormatted, ethereum: .swapDetails.originChainTxHashes[0].hash, solana: .swapDetails.destinationChainTxHashes[0].hash}'
   ```

   Expect `"status":"SUCCESS"`, `"deposited":"0.000477495116358299"` (ETH), `"usdc_out":"1.0"`, and the Ethereum and Solana transactions from the table below.

4. **The guard's settings on NEAR mainnet:**

   ```bash
   curl -s https://rpc.mainnet.near.org -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"guard.umanity.near","method_name":"get_config","args_base64":"e30="}}' \
     | jq -c '.result.result | implode | fromjson | {owner, registrar, council, mpc, solana_program, release_key}'
   ```

   Expect `"mpc":"v1.signer"` (NEAR's MPC network), `"solana_program":"UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3"` (Umanity's program on Solana) and `"release_key":"681SwgKSC4dJfn4z85QxUELsfPhw6Qm6on4UEASvUwtQ"`, the key NEAR's MPC network derived for the guard. If that RPC is busy, `https://free.rpc.fastnear.com` answers the same call.

5. **The guard's tests:**

   ```bash
   cd near/guard && cargo test
   ```

   Expect `test result: ok. 39 passed`. The first build takes a few minutes.

## Try it in the app (do X → see Y)

1. **Open https://umanity.gives/drops/1 → Give to this drop → Or pay from 30+ chains.** See every asset you can pay with. Pick ETH · Ethereum and see the exact amount to send for $1 to land in the pot. No wallet is needed for the price: the quote comes from NEAR Intents.
2. **Follow the first real gift, 9 Nov 2026** (all times UTC):

   | When | Chain | What happened | Transaction |
   | --- | --- | --- | --- |
   | 04:46:35 | Ethereum | 0.000477 ETH sent to a one-off deposit address | [0xf374cf6e…5d7c3e7](https://etherscan.io/tx/0xf374cf6e02742c374f9d644f6a39f684a02deb6117e5d4f0da79b72bf5d7c3e7) |
   | 04:47:37 | NEAR | The deposit is minted on NEAR (`bridge-mng.near` → `omft.near`) | [BMsMm9e8…KUkyL](https://nearblocks.io/txns/BMsMm9e8D9RAYc7civGbBKtnbgJnygv5tnZEh7xKUkyL) |
   | 04:48:02 | NEAR | The intent settles on `intents.near` | [7kAcDFbJ…JZZo](https://nearblocks.io/txns/7kAcDFbJ4zR4DnANSYTnT5nQ8gNcU2kcvJK3SYyeZJZo) |
   | 04:49:12 | Solana | Exactly 1.000000 USDC arrives at Umanity's treasury | [4PyvGfn5…h6n5f](https://solscan.io/tx/4PyvGfn5EGj7vPk2c2TgmgCTUxPGuAJcnrWqARRzCLVVWfgvWshVSVryC1srBpzUaAwfp5giwoUG6fmUaRCh6n5f) |
   | 04:49:15 | Solana | `give` puts it in Drop #1's pot with the giver as backer | [2tZXjMZJ…Bmp5](https://solscan.io/tx/2tZXjMZJiRemYr8ub7eoucNZWWRFnJtc4vsQaRGZWBRFnGxqqCf7YwKQHyyy63Hn8M8hcM6pR5PQ9vGp8avDBmp5) |

   2 min 40 s from deposit to pot. The same flow ran again, live, in the demo video.
3. **Open the guard on NEAR mainnet:** [`guard.umanity.near`](https://nearblocks.io/address/guard.umanity.near). See its owner, registrar and council, and the release key it read from NEAR's MPC network (table below).
4. **Open the testnet run:** the drop [registered](https://testnet.nearblocks.io/txns/DdbCmJP8BzXCJi5apP4U8eDXLhfBpRwHEqiS7EXzWpEV), the [verdict recorded](https://testnet.nearblocks.io/txns/Cju47uFy5q9UCzAHRa8za5RwDi3nDpHPVPiALeYKNkkb), and NEAR's MPC network [signing the Solana unlock](https://testnet.nearblocks.io/txns/1Lc5x1PY4o2L57qUXWYfz3G3mRi14KnTs4ArUW3KbXW) 8 seconds later.

## The tracks

| Track | What the track asks for | Where it is here |
| --- | --- | --- |
| **Real-World Money** (`realworld`) | Stablecoin rails a normal organization could use tomorrow; NEAR Intents | USDC pots for real deliveries, live with real money. Gifts from any chain through NEAR Intents, settled into the pot in the giver's name, with refunds back to the giver. |
| **AI Security & Defense** (`security`) | Policy engines, spending limits, TEE attestation: AI with money but without the keys to everything | The AI's verdict alone can't move money. The guard checks the TEE's signature on-chain, waits out a council's veto window, and lets NEAR's MPC network sign only one shape of Solana message: one `unlock`, for this drop and this approved proof. |

## What is judged

The NEAR integration, all of it written inside the hackathon's window, which opened with the announcement on 19 Oct 2026 (rule Q-001). This repository's first commit is from 27 Oct, so it holds no older code.

**The diff (rule Q-003):** [`pre-hackathon...hackathon-submission`](https://github.com/shariqazeem/umanity/compare/pre-hackathon...hackathon-submission). The `pre-hackathon` tag (3 Nov) is the devnet build before the NEAR work. At that tag only a 1Click client and its quote routes existed, written on 27 Oct, also inside the window. The gift flow into pots and the whole guard came after it, from 8 Nov.

| Path | What it is |
| --- | --- |
| [`lib/intents/oneclick.ts`](lib/intents/oneclick.ts), [`lib/umanity/intents.ts`](lib/umanity/intents.ts), [`components/drops/AnyChainGive.tsx`](components/drops/AnyChainGive.tsx), [`app/api/drops/[id]/intents/route.ts`](app/api/drops/%5Bid%5D/intents/route.ts) | NEAR Intents gifts: exact-output quotes through Aurora's Swap API on NEAR Intents 1Click, a one-off deposit address, settlement into the pot with the giver as backer, overflow returned in the same transaction, and a settler that can never pay twice. Live on mainnet since 9 Nov. |
| [`near/guard/`](near/guard) | The guard contract (near-sdk 5.30.1): verdict checking, the council, the Solana message checker, Chain Signatures. 39 tests. |
| [`lib/near/`](lib/near) | The server side: the TEE call, verdict submission, the guarded release (near-api-js). |
| [`scripts/guard-e2e.ts`](scripts/guard-e2e.ts) | A guarded release end to end, against NEAR testnet and NEAR's testnet MPC network. |
| [`scripts/near-attest.ts`](scripts/near-attest.ts) | Rechecks the TEE key the guard trusts against NEAR AI's attestation report. |
| [`components/drops/GuardCard.tsx`](components/drops/GuardCard.tsx) | What a backer sees: the verdict, the council's window, the release. |

**Disclosure (rule Q-002):** Umanity's product runs on Solana. The Solana program, the app, the x402 agent gifts and the $UMANITY token are context; the NEAR integration above is the entry.

**Libraries and tools (rule Q-005):**
- **NEAR side:** near-sdk 5.30.1 (with `bs58` and `hex`; `ed25519-dalek` in tests) and near-api-js 7. Services: NEAR Intents 1Click through Aurora's Swap API, NEAR AI Cloud and Chain Signatures (`v1.signer`).
- **Solana side:** Anchor 0.31, @solana/web3.js, @solana/kit, x402 through PayAI, Meteora's DBC SDK and Jupiter.
- **App:** Next.js 15 and React 19.
- **AI:** much of the code was written with Claude Code.

**Our other entry (rule Q-015):** the same founder also entered **[ParallaxPay](https://github.com/shariqazeem/parallaxpay-near)** in the NEAR HACKATHON: an AI agent that trades for you on NEAR, inside rules you set. The two are separate products with separate code.

## How a guarded release works

```
 Solana (money)                 NEAR (rules)                          NEAR AI Cloud (TEE)
 ──────────────                 ────────────                          ───────────────────
 post_proof(hash) ───────────▶  checker_request(drop, promise, proof)
                                  the guard writes the exact request ──▶ Qwen3-VL in Intel TDX
                                                                        reads the promise, the proof
                                                                        and its photos; answers
                                                                        VERDICT + REASON; signs
                                                                        model:sha256(req):sha256(resp)
                                submit_verdict ◀──────────────────────── answer + ed25519 signature
                                  checks the promise hash, the signature,
                                  the registered TEE key; one verdict per proof
                                  ── council window (≥ minimum fixed at deploy) ──
                                request_release(message)
                                  checks the message: one unlock, this drop,
                                  this approved proof, release key read-only
                                ──▶ v1.signer: sign (Ed25519, domain 1)
                                ◀── signature, verified against the release key
 unlock(proof) ◀────────────── signed message + the fee payer's signature
 pays the drop's fixed payee
```

## Why it holds

Each rule is enforced in code:

- **The AI cannot be fed a different request.** The guard builds the request byte for byte from three things: the checker's public instructions, the drop's promise, and the proof bundle. The promise's sha256 is registered and also on the Solana drop. The proof bundle's sha256 is the proof hash. Whoever submits a verdict only carries bytes, so they cannot inject instructions or swap the evidence. See `verdict::request` and `submit_verdict`.
- **The TEE's word is checked on-chain.** NEAR AI's model TEE signs `<model>:<sha256(request)>:<sha256(response)>` with an ed25519 key bound to its attestation. The guard recomputes that text and runs `env::ed25519_verify` against the keys the owner registered. `scripts/near-attest.ts` shows that the Intel TDX quote commits to that key and a fresh nonce.
- **The answer is read strictly.** The model's one `content` string must start with exactly `VERDICT: APPROVE` or `VERDICT: REJECT`. Text quoted inside the answer, or a reasoning field, cannot count.
- **One verdict per proof.** Verdicts are keyed by (drop, proof hash), so a junk submission can never overwrite the real proof's verdict. Storage is paid by the submitter.
- **People can stop a release but never start one.**
  - The council can veto during the review window.
  - Only the council changes the council, and it must include someone who is not the owner.
  - The window can be lengthened but never shortened below the minimum fixed at deployment.
  - The owner registers TEE keys and drops. A registrar can register drops and nothing else, so the owner's key can stay offline.
- **The MPC network signs one shape of message.** `solana::check_release` accepts only:
  - a legacy Solana message of at most 1232 bytes;
  - compute-budget settings plus exactly one Umanity `unlock(proof_hash)`, for the registered drop account;
  - the release key as a read-only signer, not the fee payer, and in the unlock's release-authority slot.

  The unlock's proof must have an approved, unvetoed verdict whose window has passed. The Solana program then refuses the unlock if the drop's proof has changed (`ProofChanged`).
- **The key is the guard's alone.** `sync_release_key` reads the key from the MPC contract (`derived_public_key` for this account and path), so nobody types it in. The MPC signature is verified against it before it is returned.
- **Refunds never need NEAR.** On Solana, anyone can refund a drop that misses its date. A stalled guard can delay a payout but never trap money.

## It runs

**On NEAR mainnet** since 9 Nov 2026, with NEAR's MPC network (`v1.signer`), beside the Umanity program on Solana mainnet:

| | |
| --- | --- |
| Guard | [`guard.umanity.near`](https://nearblocks.io/address/guard.umanity.near) ([deploy](https://nearblocks.io/txns/CgM54dhXve3sSYoD4xAkaaeJrFxU2LXHMvDrpWuUyFC6)), the same wasm as testnet (code hash `3XLhHF8P…`) |
| Roles | owner `umanity.near`, registrar `bot.umanity.near`, council `shariq7861.tg` |
| Release key, read from the MPC network by `sync_release_key` | `681SwgKSC4dJfn4z85QxUELsfPhw6Qm6on4UEASvUwtQ` |
| Checker | `Qwen/Qwen3-VL-30B-A3B-Instruct`; TEE key `c6eb7050…8b6d`, registered after a fresh attestation check (`scripts/guard-setup.ts`) |
| Review | at least 6 hours, fixed at deploy |

The Solana mainnet program still takes unlocks from Umanity's key. That key moves to the guard after the first live AI check passes on mainnet, and is then locked (see Honest status).

**On NEAR testnet**, with NEAR's testnet MPC network (`v1.signer-prod.testnet`):

| | |
| --- | --- |
| Guard | [`guard.umanity.testnet`](https://testnet.nearblocks.io/address/guard.umanity.testnet) (owner `umanity.testnet`, council `council.umanity.testnet`, registrar `bot.umanity.testnet`) |
| Release key, derived by the MPC network for the guard | `Gd2pamXQhbtweTTyNLrxE4Ey3owRE5Eum7zxsUxTr5in` |
| Checker | `Qwen/Qwen3-VL-30B-A3B-Instruct`, TEE key `c6eb7050…8b6d` |

**End to end** (`bash scripts/guard-e2e.sh`, 8 Nov 2026):
1. A local Solana validator ran the real Umanity program with the guard's key as its release authority.
2. Drop, gift and proof were posted.
3. The drop was [registered](https://testnet.nearblocks.io/txns/DdbCmJP8BzXCJi5apP4U8eDXLhfBpRwHEqiS7EXzWpEV) and the [verdict recorded](https://testnet.nearblocks.io/txns/Cju47uFy5q9UCzAHRa8za5RwDi3nDpHPVPiALeYKNkkb).
4. A release during the council's window was refused, and so was a forged answer.
5. After the window, the guard had NEAR's MPC network [sign the unlock](https://testnet.nearblocks.io/txns/1Lc5x1PY4o2L57qUXWYfz3G3mRi14KnTs4ArUW3KbXW) in 8 seconds.
6. The Solana program paid the payee.

In that run, a test key registered for the run alone stood in for the TEE, and it was removed afterwards. A live NEAR AI call needs an API key; that path is `lib/near/checker.ts` (`askTheTee`).

**Tests:**

```bash
cd near/guard && cargo test                                                                # 39 tests
NEAR_GUARD_CONTRACT=guard.umanity.testnet npx tsx scripts/near-attest.ts                    # the TEE key
bash scripts/guard-e2e.sh                                                                   # needs the testnet accounts' keys
```

## In the app

- Posting proof starts the AI check (`app/api/admin/drops`).
- Unlock goes through the guard as soon as it holds the Solana program's release key (`lib/umanity/admin.ts`).
- The daily keeper checks proofs with no verdict and releases drops that are ready (`lib/near/flow.ts`).
- On a drop's page, under the proof, backers see the AI's verdict and its one-line reason, the council's window counting down, and the MPC-signed release, each linked to NEAR.

## Honest status

- **Verified end to end on NEAR testnet** against a local Solana validator.
- **Deployed and set up on NEAR mainnet** (9 Nov 2026). What's left:
  1. ~~Deploy the same contract on NEAR mainnet (`v1.signer`).~~ Done.
  2. Run the first live NEAR AI check on a mainnet drop's proof.
  3. Point the Solana mainnet program's release authority at the guard's key (`set_release_authority`).
  4. Lock it for good (`lock_release_authority`).
  5. Add independent council members, then hand the guard's ownership to a DAO.

  Until step 4 runs, Umanity does not claim that nobody can move a pot alone.
- **Trust that remains:**
  - The owner registers TEE keys after checking attestation off-chain. The attestation check covers the quote's binding to the key and a fresh nonce, not Intel's signature chain.
  - The guard account still holds a full-access key, so it can be upgraded, until a DAO holds it.
  - The council is the founder's own wallet for now, on a different key from the owner's. Only the council can add independent members.
  - The AI sees photos and receipts but not video. The council watches the video during its window.
