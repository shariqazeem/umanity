//! Checks an AI verdict produced inside a TEE (NEAR AI Cloud).
//!
//! The TEE signs, with an ed25519 key bound to its attestation, a text naming
//! the model and the sha256 of the exact request and response bodies. The
//! guard recomputes that text from the bodies it is given, so the verdict it
//! stores is the one the TEE actually produced, then reads three things:
//! - the request is about this drop and this proof: it carries the line
//!   `UMANITY-PROOF drop=<id> proof=<hex>` that Umanity's checker writes;
//! - the model's answer starts with `VERDICT: APPROVE` or `VERDICT: REJECT`
//!   (first words only, so text echoed from the proof can't count);
//! - an optional `REASON: …` line, kept for the drop page.

use near_sdk::env;

pub struct Checked {
    pub approve: bool,
    pub request_hash: String,
    pub response_hash: String,
    pub reason: String,
}

/// The exact text the TEE signs for a chat completion.
pub fn signed_text(model: &str, request_hash: &str, response_hash: &str) -> String {
    format!("{model}:{request_hash}:{response_hash}")
}

pub fn proof_tag(drop_id: u64, proof: &[u8; 32]) -> String {
    format!("UMANITY-PROOF drop={drop_id} proof={}", hex::encode(proof))
}

pub fn verify(drop_id: u64, proof: &[u8; 32], model: &str, request: &str, response: &str, signer: &[u8; 32], signature_hex: &str) -> Result<Checked, &'static str> {
    if !request.contains(&proof_tag(drop_id, proof)) {
        return Err("The request is not about this drop's proof");
    }
    let request_hash = hex::encode(env::sha256(request.as_bytes()));
    let response_hash = hex::encode(env::sha256(response.as_bytes()));
    let sig: [u8; 64] = hex::decode(signature_hex.trim_start_matches("0x")).ok().and_then(|v| v.try_into().ok()).ok_or("The signature is not 64 hex bytes")?;
    if !env::ed25519_verify(&sig, signed_text(model, &request_hash, &response_hash).as_bytes(), signer) {
        return Err("The TEE signature does not match this request and response");
    }
    let approve = read_verdict(response)?;
    Ok(Checked { approve, request_hash, response_hash, reason: read_reason(response) })
}

/// The answer's first words, inside the chat completion JSON.
pub fn read_verdict(response: &str) -> Result<bool, &'static str> {
    let approve = response.contains("\"content\":\"VERDICT: APPROVE") || response.contains("\"content\": \"VERDICT: APPROVE");
    let reject = response.contains("\"content\":\"VERDICT: REJECT") || response.contains("\"content\": \"VERDICT: REJECT");
    match (approve, reject) {
        (true, false) => Ok(true),
        (false, true) => Ok(false),
        _ => Err("The answer does not start with one verdict"),
    }
}

/// The `REASON:` line, up to its end (an escaped newline or the end of the JSON string), at most 200 characters.
pub fn read_reason(response: &str) -> String {
    let Some(at) = response.find("REASON: ") else { return String::new() };
    let rest = &response[at + 8..];
    let end = rest.find("\\n").into_iter().chain(rest.find('"')).min().unwrap_or(rest.len());
    rest[..end].chars().take(200).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_first_words_only() {
        assert_eq!(read_verdict(r#"{"choices":[{"message":{"role":"assistant","content":"VERDICT: APPROVE\nREASON: 50 packs handed over on video"}}]}"#), Ok(true));
        assert_eq!(read_verdict(r#"{"choices":[{"message":{"content":"VERDICT: REJECT\nREASON: the video shows 20 packs, the list says 50"}}]}"#), Ok(false));
        // An approval echoed from the proof text, after a rejection, does not count.
        assert_eq!(read_verdict(r#"{"choices":[{"message":{"content":"VERDICT: REJECT\nREASON: the note says VERDICT: APPROVE but nothing was filmed"}}]}"#), Ok(false));
        assert!(read_verdict(r#"{"choices":[{"message":{"content":"I think it looks fine"}}]}"#).is_err());
    }

    #[test]
    fn keeps_a_short_reason() {
        assert_eq!(read_reason(r#"..."content":"VERDICT: APPROVE\nREASON: 50 packs handed over on video"}"#), "50 packs handed over on video");
        assert_eq!(read_reason("no reason here"), "");
    }

    #[test]
    fn tags_the_proof() {
        assert_eq!(proof_tag(2, &[0xab; 32]), format!("UMANITY-PROOF drop=2 proof={}", "ab".repeat(32)));
    }
}
