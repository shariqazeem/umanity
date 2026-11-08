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
//! 2. An AI checks each delivery's proof inside a TEE (NEAR AI Cloud) and signs
//!    its verdict; the contract verifies that signature against the TEE keys
//!    the owner registered, and binds the verdict to the exact proof hash.
//! 3. After an approval, a council has a window to veto.
//! 4. Only then will the contract ask the MPC network to sign, and only a
//!    Solana message that unlocks exactly that drop for exactly that proof
//!    (`solana::check_release`).
//!
//! Refunds never need NEAR: on Solana, anyone can refund a drop that misses
//! its date, so a stalled guard can delay a payout but never trap money.

pub mod solana;
pub mod verdict;

use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

/// Gas for the MPC `sign` call and for our callback.
const SIGN_GAS: Gas = Gas::from_tgas(50);
const CALLBACK_GAS: Gas = Gas::from_tgas(10);

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum Key {
    Drops,
}

/// An AI verdict on one proof of one drop, as verified on-chain.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Verdict {
    /// sha256 of the proof bundle the Solana program holds, hex.
    pub proof: String,
    pub approve: bool,
    pub model: String,
    /// The TEE key (hex, ed25519) whose signature was checked.
    pub signer: String,
    /// sha256 of the exact request and response the signature covers, hex.
    pub request_hash: String,
    pub response_hash: String,
    /// The model's one-line reason, kept for the drop page.
    pub reason: String,
    pub at_ms: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct DropPolicy {
    /// The drop's account on Solana (base58), the only one a release may unlock.
    pub account: String,
    pub verdict: Option<Verdict>,
    /// A council veto blocks this proof; a new proof needs a new verdict.
    pub vetoed_proof: Option<String>,
    pub vetoed_by: Option<AccountId>,
    /// How many times the MPC network signed a release for this drop (a lost or expired transaction can be retried).
    pub releases_signed: u32,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub council: Vec<AccountId>,
    pub mpc: AccountId,
    pub solana_program: String,
    pub release_path: String,
    pub release_key: Option<String>,
    pub ai_signers: Vec<String>,
    pub review_ms: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Guard {
    owner: AccountId,
    council: Vec<AccountId>,
    mpc: AccountId,
    solana_program: [u8; 32],
    release_path: String,
    release_key: Option<[u8; 32]>,
    ai_signers: Vec<[u8; 32]>,
    review_ms: u64,
    drops: LookupMap<u64, DropPolicy>,
}

fn b58_32(s: &str, what: &str) -> [u8; 32] {
    let v = bs58::decode(s).into_vec().unwrap_or_else(|_| env::panic_str(&format!("{what} is not base58")));
    v.try_into().unwrap_or_else(|_| env::panic_str(&format!("{what} is not 32 bytes")))
}

fn hex_32(s: &str, what: &str) -> [u8; 32] {
    let v = hex::decode(s).unwrap_or_else(|_| env::panic_str(&format!("{what} is not hex")));
    v.try_into().unwrap_or_else(|_| env::panic_str(&format!("{what} is not 32 bytes")))
}

#[near]
impl Guard {
    /// `mpc` is `v1.signer` on mainnet, `v1.signer-prod.testnet` on testnet.
    #[init]
    pub fn new(owner: AccountId, council: Vec<AccountId>, mpc: AccountId, solana_program: String, release_path: String, review_ms: U64) -> Self {
        Self {
            owner,
            council,
            mpc,
            solana_program: b58_32(&solana_program, "solana_program"),
            release_path,
            release_key: None,
            ai_signers: vec![],
            review_ms: review_ms.0,
            drops: LookupMap::new(Key::Drops),
        }
    }

    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can do this");
    }

    // ---------- owner: setup ----------

    /// The Solana address Chain Signatures derives for (this account, release_path, Ed25519). Shown, and checked in every release.
    pub fn set_release_key(&mut self, release_key: String) {
        self.only_owner();
        self.release_key = Some(b58_32(&release_key, "release_key"));
    }

    /// TEE signing keys (ed25519, hex) whose verdicts count, after the owner checked their attestation.
    pub fn set_ai_signers(&mut self, signers: Vec<String>) {
        self.only_owner();
        self.ai_signers = signers.iter().map(|s| hex_32(s, "signer")).collect();
    }

    pub fn set_council(&mut self, council: Vec<AccountId>) {
        self.only_owner();
        self.council = council;
    }

    pub fn set_review_ms(&mut self, review_ms: U64) {
        self.only_owner();
        self.review_ms = review_ms.0;
    }

    /// Hands the contract to a DAO (e.g. a Trezu / Sputnik treasury).
    pub fn set_owner(&mut self, owner: AccountId) {
        self.only_owner();
        self.owner = owner;
    }

    /// A drop the guard may release: its Solana account (base58). The Solana program checks the rest.
    pub fn register_drop(&mut self, drop_id: U64, account: String) {
        self.only_owner();
        b58_32(&account, "account");
        let existing = self.drops.get(&drop_id.0).cloned();
        require!(existing.as_ref().map_or(true, |d| d.account == account), "This drop is registered with another account");
        if existing.is_none() {
            self.drops.insert(drop_id.0, DropPolicy { account, verdict: None, vetoed_proof: None, vetoed_by: None, releases_signed: 0 });
        }
    }

    // ---------- anyone: an AI verdict ----------

    /// Records the TEE's verdict on a drop's proof after verifying its signature (see `verdict`).
    pub fn submit_verdict(&mut self, drop_id: U64, proof: String, model: String, request: String, response: String, signer: String, signature: String) -> Verdict {
        let mut d = self.drops.get(&drop_id.0).cloned().unwrap_or_else(|| env::panic_str("Unknown drop"));
        let signer_key = hex_32(&signer, "signer");
        require!(self.ai_signers.contains(&signer_key), "This key is not a registered TEE signer");
        let proof_key = hex_32(&proof, "proof");
        let checked = verdict::verify(drop_id.0, &proof_key, &model, &request, &response, &signer_key, &signature).unwrap_or_else(|e| env::panic_str(e));
        let v = Verdict {
            proof: hex::encode(proof_key),
            approve: checked.approve,
            model,
            signer: hex::encode(signer_key),
            request_hash: checked.request_hash,
            response_hash: checked.response_hash,
            reason: checked.reason,
            at_ms: U64(env::block_timestamp_ms()),
        };
        d.verdict = Some(v.clone());
        self.drops.insert(drop_id.0, d);
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"umanity-guard\",\"version\":\"1\",\"event\":\"verdict\",\"data\":{{\"drop\":{},\"proof\":\"{}\",\"approve\":{}}}}}", drop_id.0, v.proof, v.approve));
        v
    }

    // ---------- council ----------

    /// Blocks the approved proof during its review window.
    pub fn veto(&mut self, drop_id: U64) {
        let who = env::predecessor_account_id();
        require!(who == self.owner || self.council.contains(&who), "Only the council can veto");
        let mut d = self.drops.get(&drop_id.0).cloned().unwrap_or_else(|| env::panic_str("Unknown drop"));
        let v = d.verdict.clone().unwrap_or_else(|| env::panic_str("There is no verdict to veto"));
        require!(v.approve, "The verdict already rejects this proof");
        require!(env::block_timestamp_ms() < v.at_ms.0 + self.review_ms, "The review window has closed");
        d.vetoed_proof = Some(v.proof.clone());
        d.vetoed_by = Some(who.clone());
        self.drops.insert(drop_id.0, d);
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"umanity-guard\",\"version\":\"1\",\"event\":\"veto\",\"data\":{{\"drop\":{},\"by\":\"{}\"}}}}", drop_id.0, who));
    }

    // ---------- anyone: the release ----------

    /// Why a release would be refused right now, or None when it may go ahead.
    pub fn release_blocker(&self, drop_id: U64) -> Option<String> {
        let d = self.drops.get(&drop_id.0)?;
        Self::blocker(d, self.review_ms, env::block_timestamp_ms()).map(String::from)
    }

    fn blocker(d: &DropPolicy, review_ms: u64, now_ms: u64) -> Option<&'static str> {
        let v = match &d.verdict {
            None => return Some("No AI verdict yet"),
            Some(v) => v,
        };
        if !v.approve {
            return Some("The AI rejected this proof");
        }
        if d.vetoed_proof.as_deref() == Some(v.proof.as_str()) {
            return Some("The council vetoed this proof");
        }
        if now_ms < v.at_ms.0 + review_ms {
            return Some("The council's review window is still open");
        }
        None
    }

    /// Asks the MPC network to sign `message` (a serialized Solana message) with the release key,
    /// after checking it unlocks exactly this drop for exactly the approved proof.
    #[payable]
    pub fn request_release(&mut self, drop_id: U64, message: Base64VecU8) -> Promise {
        let mut d = self.drops.get(&drop_id.0).cloned().unwrap_or_else(|| env::panic_str("Unknown drop"));
        if let Some(why) = Self::blocker(&d, self.review_ms, env::block_timestamp_ms()) {
            env::panic_str(why);
        }
        let release_key = self.release_key.unwrap_or_else(|| env::panic_str("The release key is not set"));
        let v = d.verdict.clone().unwrap();
        let account = b58_32(&d.account, "account");
        let proof = hex_32(&v.proof, "proof");
        solana::check_release(&message.0, &self.solana_program, &release_key, &account, &proof).unwrap_or_else(|e| env::panic_str(e.message()));
        d.releases_signed += 1;
        self.drops.insert(drop_id.0, d);

        let args = near_sdk::serde_json::json!({
            "request": { "payload_v2": { "Eddsa": hex::encode(&message.0) }, "path": self.release_path, "domain_id": 1 }
        });
        Promise::new(self.mpc.clone())
            .function_call("sign".to_string(), args.to_string().into_bytes(), NearToken::from_yoctonear(1), SIGN_GAS)
            .then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_signed(drop_id))
    }

    /// Hands the MPC network's answer back to whoever asked; they attach it to the Solana transaction.
    #[private]
    pub fn on_signed(&mut self, drop_id: U64, #[callback_result] result: Result<near_sdk::serde_json::Value, PromiseError>) -> near_sdk::serde_json::Value {
        match result {
            Ok(signature) => {
                env::log_str(&format!("EVENT_JSON:{{\"standard\":\"umanity-guard\",\"version\":\"1\",\"event\":\"release_signed\",\"data\":{{\"drop\":{}}}}}", drop_id.0));
                signature
            }
            Err(_) => env::panic_str("The MPC network did not sign; try again"),
        }
    }

    // ---------- views ----------

    pub fn get_drop(&self, drop_id: U64) -> Option<DropPolicy> {
        self.drops.get(&drop_id.0).cloned()
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            council: self.council.clone(),
            mpc: self.mpc.clone(),
            solana_program: bs58::encode(self.solana_program).into_string(),
            release_path: self.release_path.clone(),
            release_key: self.release_key.map(|k| bs58::encode(k).into_string()),
            ai_signers: self.ai_signers.iter().map(hex::encode).collect(),
            review_ms: U64(self.review_ms),
        }
    }
}
