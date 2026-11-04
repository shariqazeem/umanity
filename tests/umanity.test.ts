/**
 * Program v3 tests against a local validator with Meteora's bonding curve
 * and Metaplex cloned from mainnet (scripts/test-programs.sh starts it).
 *
 * Run: bash scripts/test-programs.sh
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";
import { DynamicBondingCurveClient, deriveDbcPoolAddress } from "@meteora-ag/dynamic-bonding-curve-sdk";
import idl from "../target/idl/umanity.json";
import type { Umanity } from "../target/types/umanity";
import { umanityCurve } from "../lib/token/curve";

// Confirmed, not processed: every read below must see the write before it.
const env = anchor.AnchorProvider.env();
const conn = new Connection(env.connection.rpcEndpoint, "confirmed");
const provider = new anchor.AnchorProvider(conn, env.wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
anchor.setProvider(provider);
const program = new Program<Umanity>(idl as Umanity, provider);
const admin = (provider.wallet as anchor.Wallet).payer;

const DBC = new PublicKey("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");
const DBC_POOL_AUTHORITY = new PublicKey("FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM");
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const REVIEW_SECS = 2;

const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const u64 = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};
const configPda = pda(Buffer.from("config"));
const feesPda = pda(Buffer.from("fees"));
const dropPda = (id: number) => pda(Buffer.from("drop"), u64(id));
const backerPda = (drop: PublicKey, who: PublicKey) => pda(Buffer.from("backer"), drop.toBuffer(), who.toBuffer());
const programData = PublicKey.findProgramAddressSync([program.programId.toBuffer()], UPGRADEABLE_LOADER)[0];
const usdc = (n: number) => new BN(Math.round(n * 1e6));
const ref = () => Array.from(randomBytes(16));
const hash = (s: string) => Array.from(createHash("sha256").update(s).digest());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let usdcMint: PublicKey;
const ata = (owner: PublicKey, mint = usdcMint) => getAssociatedTokenAddressSync(mint, owner, true);
const ataIx = (owner: PublicKey, mint = usdcMint, payer = admin.publicKey) =>
  createAssociatedTokenAccountIdempotentInstruction(payer, ata(owner, mint), owner, mint);
/** Sends instructions with `signer` as the only signer and fee payer. */
const sendAs = (signer: Keypair, ixs: TransactionInstruction[]) =>
  sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [signer], { commitment: "confirmed" });
const bal = async (account: PublicKey) => Number((await getAccount(conn, account, "confirmed")).amount) / 1e6;

const releaser = Keypair.generate();
const ops = Keypair.generate();
const payee = Keypair.generate();
const stranger = Keypair.generate();
const [alice, bob, carol, dave, inter, trader] = Array.from({ length: 6 }, () => Keypair.generate());

async function airdrop(kp: Keypair, sol = 2) {
  const sig = await conn.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
}

async function chainNow() {
  const slot = await conn.getSlot("confirmed");
  return (await conn.getBlockTime(slot))!;
}

async function waitPast(ts: number) {
  while ((await chainNow()) <= ts) await sleep(400);
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: any) => {
    const text = `${e?.error?.errorCode?.code ?? ""} ${e?.message ?? e} ${JSON.stringify(e?.logs ?? e?.transactionLogs ?? [])}`;
    assert.ok(text.includes(code), `expected ${code}, got: ${text.slice(0, 600)}`);
    return true;
  });
}

const common = () => ({ config: configPda, usdcMint });

async function createDrop(goal: number, cap: number, secs: number) {
  const id = (await program.account.config.fetch(configPda)).dropCount.toNumber();
  const drop = dropPda(id);
  await program.methods
    .createDrop(usdc(goal), usdc(cap), new BN((await chainNow()) + secs), payee.publicKey, hash(`drop ${id}`))
    .accountsPartial({ ...common(), drop, pot: ata(drop), admin: admin.publicKey })
    .rpc();
  return { id, drop, pot: ata(drop) };
}

function give(drop: PublicKey, giver: Keypair, amount: number, backer = giver.publicKey, payer = giver) {
  return program.methods
    .give(usdc(amount), backer, ref())
    .accountsPartial({
      ...common(),
      drop,
      pot: ata(drop),
      backerRecord: backerPda(drop, backer),
      source: ata(giver.publicKey),
      giver: giver.publicKey,
      payer: payer.publicKey,
    })
    .signers(giver === payer ? [giver] : [giver, payer])
    .rpc();
}

async function unlock(drop: PublicKey, signer: Keypair, proof?: number[]) {
  // By default, approve the proof the drop holds now.
  const proofHash = proof ?? (await program.account.drop.fetch(drop)).proofHash;
  return program.methods
    .unlock(proofHash)
    .accountsPartial({
      ...common(),
      drop,
      pot: ata(drop),
      payee: payee.publicKey,
      payeeUsdc: ata(payee.publicKey),
      releaseAuthority: signer.publicKey,
    })
    .preInstructions([ataIx(payee.publicKey)])
    .signers([signer])
    .rpc();
}

async function refund(drop: PublicKey, backer: PublicKey, rentPayer: PublicKey, caller: Keypair = admin) {
  const ix = await program.methods
    .refund()
    .accountsPartial({
      ...common(),
      drop,
      pot: ata(drop),
      backerRecord: backerPda(drop, backer),
      backer,
      backerUsdc: ata(backer),
      rentPayer,
    })
    .instruction();
  return sendAs(caller, [ataIx(backer, usdcMint, caller.publicKey), ix]);
}

function splitAccounts() {
  return {
    ...common(),
    fees: feesPda,
    feeInbox: ata(feesPda),
    dropsFund: ata(configPda),
    ops: ops.publicKey,
    opsUsdc: ata(ops.publicKey),
  };
}

before(async () => {
  await Promise.all([admin, releaser, stranger, alice, bob, carol, dave, inter, trader].map((k) => (k === admin ? null : airdrop(k))));
  usdcMint = await createMint(conn, admin, admin.publicKey, null, 6);
  for (const k of [admin, alice, bob, inter, trader, stranger]) {
    const acct = await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, k.publicKey);
    await mintTo(conn, admin, usdcMint, acct.address, admin, 1_000 * 1e6);
  }
});

test("only the upgrade authority can set the program up", async () => {
  const accounts = {
    ...common(),
    fees: feesPda,
    feeInbox: ata(feesPda),
    dropsFund: ata(configPda),
    program: program.programId,
    programData,
  };
  await rejects(
    program.methods
      .initConfig(stranger.publicKey, stranger.publicKey, usdc(2_000), new BN(REVIEW_SECS))
      .accountsPartial({ ...accounts, admin: stranger.publicKey })
      .signers([stranger])
      .rpc(),
    "Unauthorized",
  );
  await program.methods
    .initConfig(releaser.publicKey, ops.publicKey, usdc(2_000), new BN(REVIEW_SECS))
    .accountsPartial({ ...accounts, admin: admin.publicKey })
    .rpc();
  const c = await program.account.config.fetch(configPda);
  assert.equal(c.admin.toBase58(), admin.publicKey.toBase58());
  assert.equal(c.releaseAuthority.toBase58(), releaser.publicKey.toBase58());
  assert.equal(c.maxPot.toNumber(), 2_000e6);
});

test("drops can't exceed the per-pot cap or run too long", async () => {
  const id = (await program.account.config.fetch(configPda)).dropCount.toNumber();
  const drop = dropPda(id);
  const accounts = { ...common(), drop, pot: ata(drop), admin: admin.publicKey };
  const now = await chainNow();
  await rejects(
    program.methods.createDrop(usdc(100), usdc(2_001), new BN(now + 60), payee.publicKey, hash("x")).accountsPartial(accounts).rpc(),
    "InvalidParams",
  );
  await rejects(
    program.methods.createDrop(usdc(100), usdc(150), new BN(now + 121 * 86_400), payee.publicKey, hash("x")).accountsPartial(accounts).rpc(),
    "InvalidParams",
  );
  await rejects(
    program.methods
      .createDrop(usdc(100), usdc(150), new BN(now + 60), payee.publicKey, hash("x"))
      .accountsPartial({ ...accounts, admin: stranger.publicKey })
      .signers([stranger])
      .rpc(),
    "Unauthorized",
  );
});

test("gifts fill a pot; proof, review, then unlock to the payee only", async () => {
  const { drop, pot } = await createDrop(100, 150, 120);

  await give(drop, alice, 40);
  await give(drop, bob, 30);
  // A relayed gift: admin's USDC, refundable to carol, rent paid by admin.
  await give(drop, admin, 10, carol.publicKey, admin);
  await rejects(give(drop, alice, 80.000001), "PotFull");

  // give_all: an intermediary with no SOL to spare gives whatever it holds.
  await program.methods
    .openBacker(dave.publicKey)
    .accountsPartial({ drop, backerRecord: backerPda(drop, dave.publicKey), payer: admin.publicKey })
    .rpc();
  const interBefore = await bal(ata(inter.publicKey));
  await program.methods
    .giveAll(usdc(interBefore - 25), ref())
    .accountsPartial({
      ...common(),
      drop,
      pot,
      backerRecord: backerPda(drop, dave.publicKey),
      source: ata(inter.publicKey),
      giver: inter.publicKey,
    })
    .signers([inter])
    .rpc();

  let d = await program.account.drop.fetch(drop);
  assert.equal(await bal(pot), 105);
  assert.equal(d.given.toNumber(), 105e6);
  assert.equal(d.backers, 4);
  assert.equal((await program.account.backer.fetch(backerPda(drop, carol.publicKey))).amount.toNumber(), 10e6);
  assert.equal((await program.account.backer.fetch(backerPda(drop, dave.publicKey))).amount.toNumber(), 25e6);

  await rejects(unlock(drop, releaser), "NotProven");
  await rejects(
    program.methods.postProof(hash("proof")).accountsPartial({ config: configPda, drop, admin: stranger.publicKey }).signers([stranger]).rpc(),
    "Unauthorized",
  );
  await program.methods.postProof(hash("proof")).accountsPartial({ config: configPda, drop, admin: admin.publicKey }).rpc();
  await rejects(give(drop, alice, 1), "DropClosed");
  await rejects(unlock(drop, releaser), "InReview");
  // Posting again replaces the proof and restarts the review window.
  await program.methods.postProof(hash("proof, re-filmed")).accountsPartial({ config: configPda, drop, admin: admin.publicKey }).rpc();

  d = await program.account.drop.fetch(drop);
  await waitPast(d.proofAt.toNumber() + REVIEW_SECS);
  // An unlock approved for the first proof can't pay out on the new one.
  await rejects(unlock(drop, releaser, hash("proof")), "ProofChanged");
  await rejects(unlock(drop, stranger), "Unauthorized");
  await rejects(
    program.methods
      .unlock(hash("proof, re-filmed"))
      .accountsPartial({ ...common(), drop, pot, payee: stranger.publicKey, payeeUsdc: ata(stranger.publicKey), releaseAuthority: releaser.publicKey })
      .preInstructions([ataIx(stranger.publicKey)])
      .signers([releaser])
      .rpc(),
    "WrongPayee",
  );
  await unlock(drop, releaser);

  d = await program.account.drop.fetch(drop);
  assert.equal(d.state, 2);
  assert.equal(d.unlocked.toNumber(), 105e6);
  assert.equal(await bal(ata(payee.publicKey)), 105);
  assert.equal(await bal(pot), 0);

  await rejects(unlock(drop, releaser), "NotProven");
  await rejects(refund(drop, alice.publicKey, alice.publicKey), "RefundsNotOpen");

  // After an unlock, record rent goes back to whoever paid it.
  const rentBefore = await conn.getBalance(admin.publicKey);
  const close = await program.methods
    .closeBacker()
    .accountsPartial({ drop, backerRecord: backerPda(drop, carol.publicKey), rentPayer: admin.publicKey })
    .instruction();
  await sendAs(stranger, [close]);
  assert.ok((await conn.getBalance(admin.publicKey)) > rentBefore, "rent returned to its payer");
  assert.equal(await conn.getAccountInfo(backerPda(drop, carol.publicKey)), null);
});

test("fees split 50/50 by code; the fund pays into pots; a cancelled drop refunds everyone", async () => {
  await transfer(conn, admin, ata(admin.publicKey), ata(feesPda), admin, 10e6 + 3);
  await program.methods.splitFees().accountsPartial(splitAccounts()).preInstructions([ataIx(ops.publicKey)]).rpc();
  // Ops gets the floor of half; drops get the rest, including the odd unit.
  assert.equal(await bal(ata(ops.publicKey)), 5.000001);
  assert.equal(await bal(ata(configPda)), 5.000002);
  assert.equal(await bal(ata(feesPda)), 0);
  await rejects(program.methods.splitFees().accountsPartial(splitAccounts()).rpc(), "NothingToSplit");

  const { drop, pot } = await createDrop(50, 100, 120);
  await give(drop, alice, 20);
  const fundAccounts = { ...common(), drop, pot, dropsFund: ata(configPda), admin: admin.publicKey };
  await rejects(
    program.methods.fundDrop(usdc(5)).accountsPartial({ ...fundAccounts, admin: stranger.publicKey }).signers([stranger]).rpc(),
    "Unauthorized",
  );
  await program.methods.fundDrop(usdc(5)).accountsPartial(fundAccounts).rpc();
  // A plain transfer straight to the pot address is welcome too.
  await transfer(conn, bob, ata(bob.publicKey), pot, bob, 1e6);
  assert.equal(await bal(pot), 26);

  await rejects(refund(drop, alice.publicKey, alice.publicKey), "RefundsNotOpen");
  await program.methods.cancelDrop().accountsPartial({ config: configPda, drop, admin: admin.publicKey }).rpc();
  await rejects(give(drop, bob, 1), "DropClosed");

  // Anyone can send a refund, and it can only go to the backer.
  const aliceBefore = await bal(ata(alice.publicKey));
  await refund(drop, alice.publicKey, alice.publicKey, stranger);
  assert.equal(await bal(ata(alice.publicKey)), aliceBefore + 20);
  await rejects(refund(drop, alice.publicKey, alice.publicKey, stranger), "AccountNotInitialized");

  const fundBefore = await bal(ata(configPda));
  await program.methods.returnToFund().accountsPartial({ ...common(), drop, pot, dropsFund: ata(configPda) }).rpc();
  assert.equal(await bal(ata(configPda)), fundBefore + 6);
  assert.equal(await bal(pot), 0);
  await rejects(program.methods.returnToFund().accountsPartial({ ...common(), drop, pot, dropsFund: ata(configPda) }).rpc(), "NothingToReturn");

  const d = await program.account.drop.fetch(drop);
  assert.equal(d.state, 3);
  assert.equal(d.refunded.toNumber(), 20e6);
  assert.equal(d.returned.toNumber(), 6e6);
});

test("a drop that misses its date refunds its backers", async () => {
  const { drop, pot } = await createDrop(10, 20, 6);
  await give(drop, bob, 5);
  const d = await program.account.drop.fetch(drop);
  await waitPast(d.deadline.toNumber());
  await rejects(give(drop, bob, 1), "DropClosed");
  await rejects(
    program.methods.postProof(hash("late")).accountsPartial({ config: configPda, drop, admin: admin.publicKey }).rpc(),
    "DeadlinePassed",
  );
  const bobBefore = await bal(ata(bob.publicKey));
  await refund(drop, bob.publicKey, bob.publicKey);
  assert.equal(await bal(ata(bob.publicKey)), bobBefore + 5);
  assert.equal(await bal(pot), 0);
});

test("$UMANITY trading fees on Meteora are claimed and split by the program", async () => {
  const client = new DynamicBondingCurveClient(conn, "confirmed");
  const dbcConfig = Keypair.generate();
  const configTx = await client.partner.createConfig({
    config: dbcConfig.publicKey,
    feeClaimer: feesPda,
    leftoverReceiver: feesPda,
    payer: admin.publicKey,
    quoteMint: usdcMint,
    ...umanityCurve({ initialMarketCap: 1_000, migrationMarketCap: 10_000, feeBps: 100 }),
  });
  await sendAndConfirmTransaction(conn, configTx, [admin, dbcConfig], { commitment: "confirmed" });

  const baseMint = Keypair.generate();
  const poolTx = await client.creator.createPool({
    baseMint: baseMint.publicKey,
    config: dbcConfig.publicKey,
    name: "Umanity Test",
    symbol: "UMT",
    uri: "https://umanity.vercel.app/token.json",
    payer: admin.publicKey,
    poolCreator: admin.publicKey,
  });
  await sendAndConfirmTransaction(conn, poolTx, [admin, baseMint], { commitment: "confirmed" });
  const pool = deriveDbcPoolAddress(usdcMint, baseMint.publicKey, dbcConfig.publicKey);

  const swapTx = await client.pool.swap({
    owner: trader.publicKey,
    pool,
    amountIn: usdc(100),
    minimumAmountOut: new BN(0),
    swapBaseForQuote: false,
    referralTokenAccount: null,
  });
  await sendAndConfirmTransaction(conn, swapTx, [trader], { commitment: "confirmed" });

  // getPool returns { poolState } in SDK 2.0.
  const poolState = async () => ((await client.state.getPool(pool)) as any).poolState;
  const state = await poolState();
  const owed = state.partnerQuoteFee.toNumber() / 1e6;
  assert.ok(owed > 0.7 && owed <= 0.8, `partner fee ${owed}`);

  const sweepAccounts = {
    ...splitAccounts(),
    feesBase: ata(feesPda, baseMint.publicKey),
    dbcConfig: dbcConfig.publicKey,
    dbcPool: pool,
    baseVault: state.baseVault,
    quoteVault: state.quoteVault,
    baseMint: baseMint.publicKey,
    dbcPoolAuthority: DBC_POOL_AUTHORITY,
    dbcProgram: DBC,
  };
  const pre: TransactionInstruction[] = [ataIx(feesPda, baseMint.publicKey), ataIx(ops.publicKey)];

  // The claim can't be pointed at someone else's account.
  await rejects(
    program.methods
      .sweepMeteoraFees(new BN(0), new BN("18446744073709551615"))
      .accountsPartial({ ...sweepAccounts, feeInbox: ata(trader.publicKey) })
      .preInstructions(pre)
      .rpc(),
    "Constraint",
  );

  const fundBefore = await bal(ata(configPda));
  const opsBefore = await bal(ata(ops.publicKey));
  // Anyone can run the sweep; here a stranger pays for it.
  const sweep = await program.methods
    .sweepMeteoraFees(new BN(0), new BN("18446744073709551615"))
    .accountsPartial(sweepAccounts)
    .instruction();
  await sendAs(stranger, [ataIx(feesPda, baseMint.publicKey, stranger.publicKey), sweep]);
  const toDrops = (await bal(ata(configPda))) - fundBefore;
  const toOps = (await bal(ata(ops.publicKey))) - opsBefore;
  assert.ok(Math.abs(toDrops + toOps - owed) < 1e-6, `split ${toDrops} + ${toOps} vs ${owed}`);
  assert.ok(toDrops >= toOps && toDrops - toOps <= 1e-6);
  assert.equal((await poolState()).partnerQuoteFee.toNumber(), 0);
});

test("unlock rights can be handed over, then locked for good", async () => {
  const next = Keypair.generate();
  const set = (k: PublicKey, signer = admin) =>
    program.methods
      .setReleaseAuthority(k)
      .accountsPartial({ config: configPda, admin: signer.publicKey })
      .signers(signer === admin ? [] : [signer])
      .rpc();
  await rejects(set(next.publicKey, stranger), "Unauthorized");
  await set(next.publicKey);
  await program.methods.lockReleaseAuthority().accountsPartial({ config: configPda, admin: admin.publicKey }).rpc();
  await rejects(set(releaser.publicKey), "ReleaseLocked");
  const c = await program.account.config.fetch(configPda);
  assert.equal(c.releaseAuthority.toBase58(), next.publicKey.toBase58());
  assert.equal(c.releaseLocked, true);
});
