//! Umanity Guard: NEAR holds the rules for Umanity's Solana pots.
//!
//! Umanity's money lives on Solana: every drop has a USDC pot that a Solana
//! program pays out only to the drop's fixed payee, only after proof of the
//! delivery is posted on-chain and its review window passes. Who may press
//! "unlock" is the one decision the Solana program delegates, to a release
//! key. This contract is that key's keeper:
//!
//! 1. The release key is derived by NEAR Chain Signatures for this contract's
//!    account, so only this contract can have the MPC network sign with it.
//!    The contract reads the key from the MPC contract itself.
//! 2. An AI checks each proof against the drop's promise inside a TEE (NEAR AI
//!    Cloud). The contract writes the AI's request itself from the promise and
//!    the proof, whose hashes are on Solana, and verifies the TEE's signature
//!    over that request and the answer (`verdict`).
//! 3. After an approval, a council the owner cannot change has a review window
//!    to veto. The window can be lengthened but never shortened below the
//!    minimum fixed at deployment.
//! 4. Only then does the contract ask the MPC network to sign, and only a
//!    Solana message that unlocks exactly that drop for exactly that proof
//!    (`solana::check_release`).
//!
//! Nobody alone can move a pot: the owner registers TEE keys (and drops, with
//! a registrar that can do nothing else) but
//! every approval waits out the council's window in public; the council can
//! only block; the AI only advises; the MPC network signs only what this code
//! allows. Refunds never need NEAR: on Solana, anyone can refund a drop that
//! misses its date, so a stalled guard can delay a payout but never trap money.

pub mod solana;
pub mod verdict;

use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::serde_json::{json, Value};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, Gas, GasWeight, NearToken, PanicOnDefault, Promise, PromiseError};
use verdict::Checker;

/// The MPC contract wants at least 15 Tgas for `sign`.
const SIGN_GAS: Gas = Gas::from_tgas(30);
const SIGNED_GAS: Gas = Gas::from_tgas(10);
const KEY_GAS: Gas = Gas::from_tgas(10);
const KEY_SET_GAS: Gas = Gas::from_tgas(5);
/// The MPC network's Ed25519 domain (FROST).
const ED25519_DOMAIN: u64 = 1;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum Key {
    Drops,
    Verdicts,
}

/// A drop the guard may release.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Drop {
    /// The drop's account on Solana (base58), the only one a release may unlock.
    pub account: String,
    /// sha256 of the drop's public promise (its canonical JSON), hex. The Solana drop holds the same hash.
    pub meta_hash: String,
}

/// The AI's verdict on one proof of one drop, as verified on-chain.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Verdict {
    pub drop: U64,
    /// sha256 of the proof bundle, hex: the proof hash on the Solana drop.
    pub proof: String,
    pub approve: bool,
    pub model: String,
    /// The TEE key (ed25519, hex) whose signature was checked.
    pub signer: String,
    /// sha256 of the exact request and response the signature covers, hex.
    pub request_hash: String,
    pub response_hash: String,
    /// The model's one-line reason, for the drop page.
    pub reason: String,
    pub at_ms: U64,
    /// Until then the council may veto; after it, a release may go ahead.
    pub review_ends_ms: U64,
    pub vetoed_by: Option<AccountId>,
    /// Releases signed for this proof. A lost or expired Solana transaction can be signed again; the program pays out once.
    pub releases_signed: u32,
}

/// What the MPC contract answers for an Ed25519 `sign`.
#[near(serializers = [json])]
pub struct SignatureResponse {
    pub scheme: String,
    pub signature: Vec<u8>,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub registrar: Option<AccountId>,
    pub council: Vec<AccountId>,
    pub mpc: AccountId,
    pub solana_program: String,
    pub release_path: String,
    pub release_key: Option<String>,
    pub checker: Option<Checker>,
    pub ai_signers: Vec<String>,
    pub review_ms: U64,
    pub min_review_ms: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Guard {
    owner: AccountId,
    /// May register drops and nothing else: the server's hot key, so the owner's key can stay offline.
    registrar: Option<AccountId>,
    council: Vec<AccountId>,
    mpc: AccountId,
    solana_program: [u8; 32],
    release_path: String,
    release_key: Option<[u8; 32]>,
    checker: Option<Checker>,
    ai_signers: Vec<[u8; 32]>,
    review_ms: u64,
    min_review_ms: u64,
    drops: LookupMap<u64, Drop>,
    verdicts: LookupMap<(u64, [u8; 32]), Verdict>,
}

fn b58_32(s: &str, what: &str) -> [u8; 32] {
    let v = bs58::decode(s).into_vec().unwrap_or_else(|_| env::panic_str(&format!("{what} is not base58")));
    v.try_into().unwrap_or_else(|_| env::panic_str(&format!("{what} is not 32 bytes")))
}

fn hex_32(s: &str, what: &str) -> [u8; 32] {
    let v = hex::decode(s).unwrap_or_else(|_| env::panic_str(&format!("{what} is not hex")));
    v.try_into().unwrap_or_else(|_| env::panic_str(&format!("{what} is not 32 bytes")))
}

/// NEP-297 event.
fn event(name: &str, data: Value) {
    env::log_str(&format!("EVENT_JSON:{}", json!({ "standard": "umanity-guard", "version": "1.0.0", "event": name, "data": data })));
}

/// The council must include someone other than the owner, or the owner could approve and wave through alone.
fn independent(council: &[AccountId], owner: &AccountId) -> bool {
    council.iter().any(|c| c != owner)
}

/// Why a release of this verdict's proof would be refused at `now_ms`, or None.
fn blocker(v: &Verdict, now_ms: u64) -> Option<&'static str> {
    if !v.approve {
        return Some("The AI rejected this proof");
    }
    if v.vetoed_by.is_some() {
        return Some("The council vetoed this proof");
    }
    if now_ms < v.review_ends_ms.0 {
        return Some("The council's review window is still open");
    }
    None
}

#[near]
impl Guard {
    /// `mpc` is `v1.signer` on mainnet, `v1.signer-prod.testnet` on testnet.
    /// `min_review_ms` can never be lowered: it is the shortest time the council always gets.
    #[init]
    pub fn new(owner: AccountId, council: Vec<AccountId>, mpc: AccountId, solana_program: String, release_path: String, review_ms: U64, min_review_ms: U64) -> Self {
        require!(independent(&council, &owner), "The council needs a member who is not the owner");
        require!(review_ms.0 >= min_review_ms.0, "The review window is shorter than its minimum");
        Self {
            owner,
            registrar: None,
            council,
            mpc,
            solana_program: b58_32(&solana_program, "solana_program"),
            release_path,
            release_key: None,
            checker: None,
            ai_signers: vec![],
            review_ms: review_ms.0,
            min_review_ms: min_review_ms.0,
            drops: LookupMap::new(Key::Drops),
            verdicts: LookupMap::new(Key::Verdicts),
        }
    }

    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can do this");
    }

    fn only_council(&self) -> AccountId {
        let who = env::predecessor_account_id();
        require!(self.council.contains(&who), "Only the council can do this");
        who
    }

    // ---------- anyone: the release key ----------

    /// Reads the release key from the MPC contract: the Ed25519 key it derives for this account and `release_path`.
    pub fn sync_release_key(&mut self) -> Promise {
        let args = json!({ "path": self.release_path, "predecessor": env::current_account_id(), "domain_id": ED25519_DOMAIN });
        Promise::new(self.mpc.clone())
            .function_call("derived_public_key".to_string(), args.to_string().into_bytes(), NearToken::from_yoctonear(0), KEY_GAS)
            .then(Self::ext(env::current_account_id()).with_static_gas(KEY_SET_GAS).on_release_key())
    }

    #[private]
    pub fn on_release_key(&mut self, #[callback_result] result: Result<String, PromiseError>) -> String {
        let key = result.unwrap_or_else(|_| env::panic_str("The MPC contract did not return a key"));
        let b58 = key.strip_prefix("ed25519:").unwrap_or_else(|| env::panic_str("The MPC key is not Ed25519"));
        self.release_key = Some(b58_32(b58, "release key"));
        event("release_key", json!({ "key": b58 }));
        b58.to_string()
    }

    // ---------- owner: setup ----------

    /// The AI's instructions. Everything in them is public, and the guard writes every request from them.
    pub fn set_checker(&mut self, model: String, system: String, params: String) {
        self.only_owner();
        verdict::check_params(&params).unwrap_or_else(|e| env::panic_str(e));
        require!(!model.is_empty() && !model.contains(':'), "The model id is empty or has a colon");
        self.checker = Some(Checker { model: model.clone(), system, params });
        event("checker", json!({ "model": model }));
    }

    /// TEE signing keys (ed25519, hex) whose verdicts count, after the owner checked their attestation.
    pub fn set_ai_signers(&mut self, signers: Vec<String>) {
        self.only_owner();
        self.ai_signers = signers.iter().map(|s| hex_32(s, "signer")).collect();
        event("ai_signers", json!({ "signers": signers }));
    }

    /// Applies to verdicts submitted from now on; never below the minimum fixed at deployment.
    pub fn set_review_ms(&mut self, review_ms: U64) {
        self.only_owner();
        require!(review_ms.0 >= self.min_review_ms, "The review window is shorter than its minimum");
        self.review_ms = review_ms.0;
        event("review", json!({ "review_ms": review_ms }));
    }

    /// The account that may register drops (the server's bot), or None.
    pub fn set_registrar(&mut self, registrar: Option<AccountId>) {
        self.only_owner();
        self.registrar = registrar.clone();
        event("registrar", json!({ "registrar": registrar }));
    }

    /// Hands the contract to a DAO (e.g. a Sputnik / Trezu treasury).
    pub fn set_owner(&mut self, owner: AccountId) {
        self.only_owner();
        require!(independent(&self.council, &owner), "The council needs a member who is not the new owner");
        self.owner = owner.clone();
        event("owner", json!({ "owner": owner }));
    }

    /// A drop the guard may release: its Solana account (base58) and the sha256 of its promise (hex), both as on the Solana drop.
    /// The owner or the registrar; a registration never changes.
    pub fn register_drop(&mut self, drop_id: U64, account: String, meta_hash: String) {
        let who = env::predecessor_account_id();
        require!(who == self.owner || self.registrar.as_ref() == Some(&who), "Only the owner or the registrar can register drops");
        b58_32(&account, "account");
        hex_32(&meta_hash, "meta_hash");
        require!(self.drops.get(&drop_id.0).is_none(), "This drop is already registered");
        self.drops.insert(drop_id.0, Drop { account: account.clone(), meta_hash: meta_hash.clone() });
        event("drop", json!({ "drop": drop_id, "account": account, "meta_hash": meta_hash }));
    }

    // ---------- anyone: an AI verdict ----------

    /// Records the TEE's verdict on a drop's proof. `meta` is the drop's promise and `bundle` its proof,
    /// both exactly as hashed on Solana; the guard rebuilds the AI's request from them and checks the
    /// TEE's signature over it and `response`. One verdict per proof. Attach a little NEAR for storage;
    /// what is not used comes back.
    #[payable]
    pub fn submit_verdict(&mut self, drop_id: U64, meta: String, bundle: String, response: String, signer: String, signature: String) -> Verdict {
        let before = env::storage_usage();
        let drop = self.drops.get(&drop_id.0).cloned().unwrap_or_else(|| env::panic_str("Unknown drop"));
        let checker = self.checker.clone().unwrap_or_else(|| env::panic_str("The AI checker is not set"));
        require!(hex::encode(env::sha256_array(meta.as_bytes())) == drop.meta_hash, "This is not the drop's promise");
        let proof = env::sha256_array(bundle.as_bytes());
        require!(self.verdicts.get(&(drop_id.0, proof)).is_none(), "This proof already has a verdict");
        let signer_key = hex_32(&signer, "signer");
        require!(self.ai_signers.contains(&signer_key), "This key is not a registered TEE signer");

        let request = verdict::request(&checker, drop_id.0, &proof, &meta, &bundle);
        let checked = verdict::verify(&checker.model, &request, &response, &signer_key, &signature).unwrap_or_else(|e| env::panic_str(e));
        let now = env::block_timestamp_ms();
        let v = Verdict {
            drop: drop_id,
            proof: hex::encode(proof),
            approve: checked.approve,
            model: checker.model,
            signer: hex::encode(signer_key),
            request_hash: checked.request_hash,
            response_hash: checked.response_hash,
            reason: checked.reason,
            at_ms: U64(now),
            review_ends_ms: U64(now + self.review_ms),
            vetoed_by: None,
            releases_signed: 0,
        };
        self.verdicts.insert((drop_id.0, proof), v.clone());
        self.verdicts.flush();

        let cost = env::storage_byte_cost().saturating_mul(u128::from(env::storage_usage().saturating_sub(before)));
        let paid = env::attached_deposit();
        require!(paid >= cost, format!("Attach at least {} yoctoNEAR for storage", cost.as_yoctonear()));
        if paid > cost {
            let _ = Promise::new(env::predecessor_account_id()).transfer(paid.saturating_sub(cost));
        }
        event(
            "verdict",
            json!({ "drop": drop_id, "proof": v.proof, "approve": v.approve, "reason": v.reason, "model": v.model, "request_hash": v.request_hash, "response_hash": v.response_hash, "review_ends_ms": v.review_ends_ms }),
        );
        v
    }

    // ---------- council ----------

    /// Blocks an approved proof during its review window. The team can post a new proof, which needs a new verdict.
    pub fn veto(&mut self, drop_id: U64, proof: String) {
        let who = self.only_council();
        let key = (drop_id.0, hex_32(&proof, "proof"));
        let v = self.verdicts.get_mut(&key).unwrap_or_else(|| env::panic_str("There is no verdict for this proof"));
        require!(v.approve, "The AI already rejected this proof");
        require!(v.vetoed_by.is_none(), "This proof is already vetoed");
        require!(env::block_timestamp_ms() < v.review_ends_ms.0, "The review window has closed");
        v.vetoed_by = Some(who.clone());
        event("veto", json!({ "drop": drop_id, "proof": proof, "by": who }));
    }

    /// Only the council changes the council; the owner cannot.
    pub fn set_council(&mut self, council: Vec<AccountId>) {
        self.only_council();
        require!(independent(&council, &self.owner), "The council needs a member who is not the owner");
        self.council = council.clone();
        event("council", json!({ "council": council }));
    }

    // ---------- anyone: the release ----------

    /// Asks the MPC network to sign `message` (a serialized Solana message) with the release key, after
    /// checking that it unlocks exactly this drop for a proof whose approval has passed review unvetoed.
    /// Returns the signature (base58) to attach to the Solana transaction.
    pub fn request_release(&mut self, drop_id: U64, message: Base64VecU8) -> Promise {
        let drop = self.drops.get(&drop_id.0).unwrap_or_else(|| env::panic_str("Unknown drop"));
        let release_key = self.release_key.unwrap_or_else(|| env::panic_str("The release key is not synced yet"));
        let release = solana::check_release(&message.0, &self.solana_program, &release_key, &b58_32(&drop.account, "account")).unwrap_or_else(|e| env::panic_str(e.message()));
        let v = self.verdicts.get(&(drop_id.0, release.proof)).unwrap_or_else(|| env::panic_str("The AI has not checked this proof"));
        if let Some(why) = blocker(v, env::block_timestamp_ms()) {
            env::panic_str(why);
        }
        let args = json!({ "request": { "path": self.release_path, "payload_v2": { "Eddsa": hex::encode(&message.0) }, "domain_id": ED25519_DOMAIN } });
        Promise::new(self.mpc.clone())
            .function_call_weight("sign".to_string(), args.to_string().into_bytes(), NearToken::from_yoctonear(1), SIGN_GAS, GasWeight(0))
            .then(Self::ext(env::current_account_id()).with_static_gas(SIGNED_GAS).on_signed(drop_id, hex::encode(release.proof), message))
    }

    /// Checks the MPC network's signature against the release key and hands it back, base58.
    #[private]
    pub fn on_signed(&mut self, drop_id: U64, proof: String, message: Base64VecU8, #[callback_result] result: Result<SignatureResponse, PromiseError>) -> String {
        let r = result.unwrap_or_else(|_| env::panic_str("The MPC network did not sign in time; ask again"));
        require!(r.scheme == "Ed25519", "The MPC network answered with another scheme");
        let sig: [u8; 64] = r.signature.try_into().unwrap_or_else(|_| env::panic_str("The signature is not 64 bytes"));
        let key = self.release_key.unwrap_or_else(|| env::panic_str("The release key is not synced yet"));
        require!(env::ed25519_verify(&sig, &message.0, &key), "The MPC signature does not match the release key");
        if let Some(v) = self.verdicts.get_mut(&(drop_id.0, hex_32(&proof, "proof"))) {
            v.releases_signed += 1;
        }
        let signature = bs58::encode(sig).into_string();
        event("release_signed", json!({ "drop": drop_id, "proof": proof, "signature": signature }));
        signature
    }

    // ---------- views ----------

    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            registrar: self.registrar.clone(),
            council: self.council.clone(),
            mpc: self.mpc.clone(),
            solana_program: bs58::encode(self.solana_program).into_string(),
            release_path: self.release_path.clone(),
            release_key: self.release_key.map(|k| bs58::encode(k).into_string()),
            checker: self.checker.clone(),
            ai_signers: self.ai_signers.iter().map(hex::encode).collect(),
            review_ms: U64(self.review_ms),
            min_review_ms: U64(self.min_review_ms),
        }
    }

    pub fn get_drop(&self, drop_id: U64) -> Option<Drop> {
        self.drops.get(&drop_id.0).cloned()
    }

    pub fn get_verdict(&self, drop_id: U64, proof: String) -> Option<Verdict> {
        self.verdicts.get(&(drop_id.0, hex_32(&proof, "proof"))).cloned()
    }

    /// Why a release of this proof would be refused right now, or None when it may go ahead.
    pub fn release_blocker(&self, drop_id: U64, proof: String) -> Option<String> {
        if self.drops.get(&drop_id.0).is_none() {
            return Some("The guard does not know this drop".into());
        }
        match self.verdicts.get(&(drop_id.0, hex_32(&proof, "proof"))) {
            None => Some("The AI has not checked this proof".into()),
            Some(v) => blocker(v, env::block_timestamp_ms()).map(String::from),
        }
    }

    /// The exact request body to send to the TEE for this promise and proof.
    pub fn checker_request(&self, drop_id: U64, meta: String, bundle: String) -> String {
        let checker = self.checker.as_ref().unwrap_or_else(|| env::panic_str("The AI checker is not set"));
        if let Some(d) = self.drops.get(&drop_id.0) {
            require!(hex::encode(env::sha256_array(meta.as_bytes())) == d.meta_hash, "This is not the drop's promise");
        }
        verdict::request(checker, drop_id.0, &env::sha256_array(bundle.as_bytes()), &meta, &bundle)
    }
}

#[cfg(test)]
mod tests;
