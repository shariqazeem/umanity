# Umanity Guard: Solana holds the money, NEAR holds the rules

Umanity funds real deliveries ("drops"). Each drop has a USDC pot on Solana that pays its team only after proof of the delivery is posted on-chain, and refunds every backer by code if the date passes. One decision was still a single key: who may press "unlock".

**The NEAR guard takes that key away from people.** The release key becomes a key that only a NEAR contract can use, through Chain Signatures. The contract signs an unlock only after:
1. an AI has checked the proof against the promise inside a TEE (NEAR AI Cloud) and the contract has verified the TEE's signature;
2. a council the owner cannot change has had a review window to veto.

The contract will sign nothing but that one unlock.

Track: **AI Security & Defense**. It also fits **Social Money**, as a programmable treasury that releases only on proof.

## What is judged

Only NEAR work built during the hackathon, all of it after the `pre-hackathon` tag:

| Path | What it is |
| --- | --- |
| [`near/guard/`](near/guard) | The guard contract (near-sdk 5.30.1): verdict checking, the council, the Solana message checker, Chain Signatures. 39 tests. |
| [`lib/near/`](lib/near) | The server side: the TEE call, verdict submission, the guarded release (near-api-js). |
| [`scripts/guard-e2e.ts`](scripts/guard-e2e.ts) | A guarded release end to end, against NEAR testnet and NEAR's testnet MPC network. |
| [`scripts/near-attest.ts`](scripts/near-attest.ts) | Rechecks the TEE key the guard trusts against NEAR AI's attestation report. |
| [`components/drops/GuardCard.tsx`](components/drops/GuardCard.tsx) | What a backer sees: the verdict, the council's window, the release. |

The Solana program, the app and the other integrations existed before and are context, not entries.

## How a release works

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
