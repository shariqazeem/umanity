//! The guard's rules, run against near-sdk's mocked chain.

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::test_utils::{accounts, get_logs, VMContextBuilder};
use near_sdk::{testing_env, VMContext};

const PROGRAM: &str = "UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3";
const MODEL: &str = "z-ai/glm-5.3-flash";
const META: &str = r#"{"items":[{"name":"Rice 5kg","qty":50}],"place":"Gulberg, Lahore","title":"Rice for 50 families"}"#;
const BUNDLE: &str = r#"{"at":"2026-11-08T10:00:00.000Z","body":"50 bags handed over","drop":2,"media":[{"kind":"video","sha256":null,"url":"https://x.com/umanity_xyz/status/1"}],"title":"Delivered","v":1,"xPostUrl":null}"#;
const REVIEW: u64 = 60_000;
const T0: u64 = 1_800_000_000_000;

fn owner() -> AccountId {
    accounts(0)
}
fn council() -> AccountId {
    accounts(1)
}
fn anyone() -> AccountId {
    accounts(2)
}
fn guard_id() -> AccountId {
    "guard.umanity.testnet".parse().unwrap()
}

fn ctx(who: AccountId, now_ms: u64, deposit: NearToken) -> VMContext {
    VMContextBuilder::new()
        .current_account_id(guard_id())
        .predecessor_account_id(who.clone())
        .signer_account_id(who)
        .block_timestamp(now_ms * 1_000_000)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(10))
        .build()
}

fn at(who: AccountId, now_ms: u64) {
    testing_env!(ctx(who, now_ms, NearToken::from_yoctonear(0)));
}

fn tee() -> SigningKey {
    SigningKey::from_bytes(&[42u8; 32])
}
fn release() -> SigningKey {
    SigningKey::from_bytes(&[77u8; 32])
}
fn sha(s: &str) -> String {
    hex::encode(env::sha256_array(s.as_bytes()))
}
fn drop_account() -> [u8; 32] {
    [4u8; 32]
}

fn response(verdict: &str) -> String {
    format!(r#"{{"id":"chatcmpl-1","object":"chat.completion","model":"{MODEL}","choices":[{{"index":0,"message":{{"role":"assistant","content":"VERDICT: {verdict}\nREASON: 50 bags at Gulberg, on video"}},"finish_reason":"stop"}}]}}"#)
}

/// What NEAR AI Cloud's TEE signs: `<model>:<sha256(request)>:<sha256(response)>`.
fn tee_sign(g: &Guard, meta: &str, bundle: &str, response: &str) -> String {
    let request = g.checker_request(U64(2), meta.into(), bundle.into());
    hex::encode(tee().sign(verdict::signed_text(MODEL, &sha(&request), &sha(response)).as_bytes()).to_bytes())
}

/// A guard with the checker, the TEE key and drop 2 registered.
fn setup() -> Guard {
    at(owner(), T0);
    let mut g = Guard::new(owner(), vec![council()], "v1.signer-prod.testnet".parse().unwrap(), PROGRAM.into(), "umanity-release".into(), U64(REVIEW), U64(REVIEW));
    g.set_checker(MODEL.into(), "You review delivery proofs.".into(), ",\"temperature\":0".into());
    g.set_ai_signers(vec![hex::encode(tee().verifying_key().to_bytes())]);
    g.register_drop(U64(2), bs58::encode(drop_account()).into_string(), sha(META));
    g
}

fn submit(g: &mut Guard, verdict: &str) -> Verdict {
    let r = response(verdict);
    let sig = tee_sign(g, META, BUNDLE, &r);
    testing_env!(ctx(anyone(), T0 + 1_000, NearToken::from_millinear(10)));
    g.submit_verdict(U64(2), META.into(), BUNDLE.into(), r, hex::encode(tee().verifying_key().to_bytes()), sig)
}

/// Sets the release key with the MPC contract's answer to `derived_public_key`.
/// (Called directly, a callback takes its promise result as an argument.)
fn sync_key(g: &mut Guard, key: [u8; 32]) {
    at(guard_id(), T0);
    g.on_release_key(Ok(format!("ed25519:{}", bs58::encode(key).into_string())));
}

fn mpc_answer(sig: [u8; 64]) -> Result<SignatureResponse, PromiseError> {
    Ok(SignatureResponse { scheme: "Ed25519".into(), signature: sig.to_vec() })
}

fn compact(n: usize, out: &mut Vec<u8>) {
    let mut v = n;
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
}

/// payer (writable signer), release key (read-only signer), drop, pot, payee, payee_usdc, config, mint, token, program, compute budget.
fn unlock_message(release_key: [u8; 32], proof: [u8; 32]) -> Vec<u8> {
    let program: [u8; 32] = bs58::decode(PROGRAM).into_vec().unwrap().try_into().unwrap();
    let keys = [[1u8; 32], release_key, drop_account(), [10u8; 32], [11u8; 32], [12u8; 32], [13u8; 32], [14u8; 32], [15u8; 32], program, solana::COMPUTE_BUDGET_PROGRAM];
    let mut m = vec![2u8, 1, 6];
    compact(keys.len(), &mut m);
    keys.iter().for_each(|k| m.extend_from_slice(k));
    m.extend_from_slice(&[2u8; 32]);
    let mut data = solana::UNLOCK_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&proof);
    let ixs: [(u8, Vec<u8>, Vec<u8>); 2] = [(10, vec![], vec![2, 0, 0, 0, 0]), (9, vec![6, 2, 3, 4, 5, 1, 7, 8], data)];
    compact(ixs.len(), &mut m);
    for (p, accts, data) in ixs {
        m.push(p);
        compact(accts.len(), &mut m);
        m.extend_from_slice(&accts);
        compact(data.len(), &mut m);
        m.extend_from_slice(&data);
    }
    m
}

#[test]
fn records_a_verdict_on_the_real_promise_and_proof() {
    let mut g = setup();
    let v = submit(&mut g, "APPROVE");
    assert!(v.approve);
    assert_eq!(v.proof, sha(BUNDLE));
    assert_eq!(v.reason, "50 bags at Gulberg, on video");
    assert_eq!(v.review_ends_ms.0, T0 + 1_000 + REVIEW);
    assert!(get_logs().iter().any(|l| l.contains("\"event\":\"verdict\"")));
    at(anyone(), T0 + 2_000);
    assert_eq!(g.release_blocker(U64(2), sha(BUNDLE)).as_deref(), Some("The council's review window is still open"));
    at(anyone(), T0 + 1_000 + REVIEW);
    assert_eq!(g.release_blocker(U64(2), sha(BUNDLE)), None);
    assert_eq!(g.release_blocker(U64(2), sha("another proof")).as_deref(), Some("The AI has not checked this proof"));
}

#[test]
fn a_rejection_blocks_the_release() {
    let mut g = setup();
    assert!(!submit(&mut g, "REJECT").approve);
    at(anyone(), T0 + 10 * REVIEW);
    assert_eq!(g.release_blocker(U64(2), sha(BUNDLE)).as_deref(), Some("The AI rejected this proof"));
}

#[test]
#[should_panic(expected = "This is not the drop's promise")]
fn refuses_another_promise() {
    let mut g = setup();
    let fake = r#"{"items":[],"place":"anywhere","title":"Nothing"}"#;
    let r = response("APPROVE");
    testing_env!(ctx(anyone(), T0, NearToken::from_millinear(10)));
    g.submit_verdict(U64(2), fake.into(), BUNDLE.into(), r, hex::encode(tee().verifying_key().to_bytes()), hex::encode([0u8; 64]));
}

#[test]
#[should_panic(expected = "This key is not a registered TEE signer")]
fn refuses_an_unknown_signer() {
    let mut g = setup();
    let r = response("APPROVE");
    let other = SigningKey::from_bytes(&[1u8; 32]);
    testing_env!(ctx(anyone(), T0, NearToken::from_millinear(10)));
    g.submit_verdict(U64(2), META.into(), BUNDLE.into(), r, hex::encode(other.verifying_key().to_bytes()), hex::encode([0u8; 64]));
}

#[test]
#[should_panic(expected = "The TEE signature does not match this request and response")]
fn refuses_an_answer_the_tee_did_not_give() {
    let mut g = setup();
    let sig = tee_sign(&g, META, BUNDLE, &response("REJECT"));
    testing_env!(ctx(anyone(), T0, NearToken::from_millinear(10)));
    g.submit_verdict(U64(2), META.into(), BUNDLE.into(), response("APPROVE"), hex::encode(tee().verifying_key().to_bytes()), sig);
}

#[test]
#[should_panic(expected = "This proof already has a verdict")]
fn keeps_one_verdict_per_proof() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    submit(&mut g, "REJECT");
}

#[test]
#[should_panic(expected = "Attach at least")]
fn charges_for_storage() {
    let mut g = setup();
    let r = response("APPROVE");
    let sig = tee_sign(&g, META, BUNDLE, &r);
    testing_env!(ctx(anyone(), T0, NearToken::from_yoctonear(0)));
    g.submit_verdict(U64(2), META.into(), BUNDLE.into(), r, hex::encode(tee().verifying_key().to_bytes()), sig);
}

#[test]
fn the_council_vetoes_within_the_window() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    at(council(), T0 + 2_000);
    g.veto(U64(2), sha(BUNDLE));
    at(anyone(), T0 + 10 * REVIEW);
    assert_eq!(g.release_blocker(U64(2), sha(BUNDLE)).as_deref(), Some("The council vetoed this proof"));
}

#[test]
#[should_panic(expected = "The review window has closed")]
fn no_veto_after_the_window() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    at(council(), T0 + 1_000 + REVIEW);
    g.veto(U64(2), sha(BUNDLE));
}

#[test]
#[should_panic(expected = "Only the council can do this")]
fn the_owner_cannot_veto() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    at(owner(), T0 + 2_000);
    g.veto(U64(2), sha(BUNDLE));
}

#[test]
#[should_panic(expected = "Only the council can do this")]
fn the_owner_cannot_change_the_council() {
    let mut g = setup();
    at(owner(), T0);
    g.set_council(vec![accounts(3)]);
}

#[test]
#[should_panic(expected = "The council needs a member who is not the owner")]
fn the_council_cannot_be_only_the_owner() {
    let mut g = setup();
    at(council(), T0);
    g.set_council(vec![owner()]);
}

#[test]
#[should_panic(expected = "The review window is shorter than its minimum")]
fn the_review_window_never_drops_below_its_minimum() {
    let mut g = setup();
    at(owner(), T0);
    g.set_review_ms(U64(REVIEW - 1));
}

#[test]
#[should_panic(expected = "params may not set model, messages, stream or n")]
fn the_checker_cannot_hide_other_messages() {
    let mut g = setup();
    at(owner(), T0);
    g.set_checker(MODEL.into(), "x".into(), ",\"messages\":[]".into());
}

#[test]
fn releases_only_an_approved_proof_after_review_and_checks_the_mpc_signature() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    let key = release().verifying_key().to_bytes();
    sync_key(&mut g, key);
    assert_eq!(g.get_config().release_key, Some(bs58::encode(key).into_string()));

    let message = unlock_message(key, env::sha256_array(BUNDLE.as_bytes()));
    at(anyone(), T0 + 1_000 + REVIEW);
    let _ = g.request_release(U64(2), Base64VecU8(message.clone()));

    // The MPC network's answer, as its contract returns it.
    let sig = release().sign(&message).to_bytes();
    at(guard_id(), T0 + 2 * REVIEW);
    let out = g.on_signed(U64(2), sha(BUNDLE), Base64VecU8(message), mpc_answer(sig));
    assert_eq!(out, bs58::encode(sig).into_string());
    assert_eq!(g.get_verdict(U64(2), sha(BUNDLE)).unwrap().releases_signed, 1);
}

#[test]
#[should_panic(expected = "The council's review window is still open")]
fn no_release_during_review() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    let key = release().verifying_key().to_bytes();
    sync_key(&mut g, key);
    at(anyone(), T0 + 2_000);
    let _ = g.request_release(U64(2), Base64VecU8(unlock_message(key, env::sha256_array(BUNDLE.as_bytes()))));
}

#[test]
#[should_panic(expected = "The AI has not checked this proof")]
fn no_release_for_another_proof() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    let key = release().verifying_key().to_bytes();
    sync_key(&mut g, key);
    at(anyone(), T0 + 2 * REVIEW);
    let _ = g.request_release(U64(2), Base64VecU8(unlock_message(key, [9u8; 32])));
}

#[test]
#[should_panic(expected = "The MPC network did not sign in time")]
fn a_timed_out_signature_asks_again() {
    let mut g = setup();
    at(guard_id(), T0);
    g.on_signed(U64(2), sha(BUNDLE), Base64VecU8(vec![]), Err(PromiseError::Failed));
}

#[test]
#[should_panic(expected = "The MPC signature does not match the release key")]
fn refuses_a_signature_from_another_key() {
    let mut g = setup();
    submit(&mut g, "APPROVE");
    let key = release().verifying_key().to_bytes();
    sync_key(&mut g, key);
    let message = unlock_message(key, env::sha256_array(BUNDLE.as_bytes()));
    let sig = tee().sign(&message).to_bytes();
    at(guard_id(), T0 + 2 * REVIEW);
    g.on_signed(U64(2), sha(BUNDLE), Base64VecU8(message), mpc_answer(sig));
}

#[test]
fn the_registrar_registers_drops_and_nothing_else() {
    let mut g = setup();
    at(owner(), T0);
    g.set_registrar(Some(accounts(4)));
    at(accounts(4), T0);
    g.register_drop(U64(3), bs58::encode([5u8; 32]).into_string(), sha(META));
    assert_eq!(g.get_drop(U64(3)).unwrap().meta_hash, sha(META));
}

#[test]
#[should_panic(expected = "Only the owner can do this")]
fn the_registrar_cannot_change_the_tee_keys() {
    let mut g = setup();
    at(owner(), T0);
    g.set_registrar(Some(accounts(4)));
    at(accounts(4), T0);
    g.set_ai_signers(vec![]);
}

#[test]
#[should_panic(expected = "This drop is already registered")]
fn a_registration_never_changes() {
    let mut g = setup();
    at(owner(), T0);
    g.register_drop(U64(2), bs58::encode([5u8; 32]).into_string(), sha("another promise"));
}

#[test]
#[should_panic(expected = "Only the owner or the registrar can register drops")]
fn strangers_cannot_register_drops() {
    let mut g = setup();
    at(anyone(), T0);
    g.register_drop(U64(3), bs58::encode([5u8; 32]).into_string(), sha(META));
}
