//! The AI check of a delivery's proof, run inside a TEE (NEAR AI Cloud).
//!
//! The guard writes the AI's request itself, byte for byte, from three things
//! nobody can change after the fact: the checker's instructions (public on the
//! guard), the drop's promise (its hash is on the Solana drop and registered
//! here) and the proof bundle (its hash is the proof on the Solana drop). So a
//! verdict can only be about the real promise and the real proof, and whoever
//! submits it cannot slip other instructions into the request.
//!
//! The model sees the proof's photos and receipts too: the guard attaches the
//! bundle's https image links (at most four) to the request. Their file hashes
//! are in the bundle, so anyone can check the files the model was shown.
//!
//! The TEE signs, with an ed25519 key bound to its attestation, the text
//! `<model>:<sha256 of the request>:<sha256 of the response>`. The guard
//! recomputes it from the request it wrote and the response it is given, so
//! the verdict it stores is the one the TEE produced. The model's answer must
//! be exactly two lines: `VERDICT: APPROVE` or `VERDICT: REJECT`, then
//! `REASON: …`.

use near_sdk::{env, near};

/// The checker's instructions: which model, its system prompt, and extra request fields.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Checker {
    /// The model id, exactly as the TEE names it in what it signs.
    pub model: String,
    pub system: String,
    /// Extra request fields, each starting with a comma, e.g. `,"temperature":0,"max_tokens":120`.
    pub params: String,
}

pub struct Checked {
    pub approve: bool,
    pub request_hash: String,
    pub response_hash: String,
    pub reason: String,
}

/// Fields the guard writes itself; `params` may not repeat them.
const RESERVED: [&str; 4] = ["\"model\"", "\"messages\"", "\"stream\"", "\"n\""];

pub fn check_params(params: &str) -> Result<(), &'static str> {
    if !(params.is_empty() || params.starts_with(',')) {
        return Err("params must be empty or start with a comma");
    }
    if RESERVED.iter().any(|f| params.contains(f)) {
        return Err("params may not set model, messages, stream or n");
    }
    Ok(())
}

/// A JSON string literal, escaped exactly as JavaScript's `JSON.stringify` escapes it.
pub fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// The most images one request carries.
pub const MAX_IMAGES: usize = 4;

/// The bundle's photos and receipts the model can open: https links to jpg, png, webp or gif files, in order.
pub fn images(bundle: &str) -> Vec<String> {
    let Ok(v) = near_sdk::serde_json::from_str::<near_sdk::serde_json::Value>(bundle) else { return vec![] };
    let Some(media) = v["media"].as_array() else { return vec![] };
    media
        .iter()
        .filter_map(|m| {
            let (kind, url) = (m["kind"].as_str()?, m["url"].as_str()?);
            let path = url.split(['?', '#']).next()?.to_ascii_lowercase();
            let image = [".jpg", ".jpeg", ".png", ".webp", ".gif"].iter().any(|e| path.ends_with(e));
            ((kind == "photo" || kind == "receipt") && url.starts_with("https://") && image).then(|| url.to_string())
        })
        .take(MAX_IMAGES)
        .collect()
}

pub fn proof_tag(drop_id: u64, proof: &[u8; 32]) -> String {
    format!("UMANITY-PROOF drop={drop_id} proof={}", hex::encode(proof))
}

/// The exact chat request body the TEE must have answered for this drop's promise and proof.
pub fn request(checker: &Checker, drop_id: u64, proof: &[u8; 32], meta: &str, bundle: &str) -> String {
    let text = format!("{}\nPROMISE {meta}\nPROOF {bundle}", proof_tag(drop_id, proof));
    let mut content = format!("[{{\"type\":\"text\",\"text\":{}}}", json_str(&text));
    for url in images(bundle) {
        content.push_str(&format!(",{{\"type\":\"image_url\",\"image_url\":{{\"url\":{}}}}}", json_str(&url)));
    }
    content.push(']');
    format!(
        "{{\"model\":{},\"messages\":[{{\"role\":\"system\",\"content\":{}}},{{\"role\":\"user\",\"content\":{content}}}],\"stream\":false{}}}",
        json_str(&checker.model),
        json_str(&checker.system),
        checker.params
    )
}

/// The exact text the TEE signs for a chat completion it served itself.
pub fn signed_text(model: &str, request_hash: &str, response_hash: &str) -> String {
    format!("{model}:{request_hash}:{response_hash}")
}

pub fn verify(model: &str, request: &str, response: &str, signer: &[u8; 32], signature_hex: &str) -> Result<Checked, &'static str> {
    let request_hash = hex::encode(env::sha256_array(request.as_bytes()));
    let response_hash = hex::encode(env::sha256_array(response.as_bytes()));
    let sig: [u8; 64] = hex::decode(signature_hex.trim_start_matches("0x")).ok().and_then(|v| v.try_into().ok()).ok_or("The signature is not 64 hex bytes")?;
    if !env::ed25519_verify(&sig, signed_text(model, &request_hash, &response_hash).as_bytes(), signer) {
        return Err("The TEE signature does not match this request and response");
    }
    let (approve, reason) = read_answer(response)?;
    Ok(Checked { approve, request_hash, response_hash, reason })
}

/// The verdict and reason from a chat completion: the one `content` string that starts with `VERDICT: `.
pub fn read_answer(response: &str) -> Result<(bool, String), &'static str> {
    let mut start = None;
    for pattern in ["\"content\":\"VERDICT: ", "\"content\": \"VERDICT: "] {
        for (at, _) in response.match_indices(pattern) {
            if start.is_some() {
                return Err("The response holds more than one answer");
            }
            start = Some(at + pattern.len() - "VERDICT: ".len());
        }
    }
    let text = read_json_string(&response[start.ok_or("The answer does not start with a verdict")?..]).ok_or("The answer is not a valid JSON string")?;
    let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
    let approve = match lines.next().map(|l| l.trim_end_matches('.')) {
        Some("VERDICT: APPROVE") => true,
        Some("VERDICT: REJECT") => false,
        _ => return Err("The verdict is neither APPROVE nor REJECT"),
    };
    let reason = lines.find_map(|l| l.strip_prefix("REASON:")).map(|r| r.trim().chars().take(200).collect()).unwrap_or_default();
    Ok((approve, reason))
}

/// Reads a JSON string body (after its opening quote) up to the closing quote, unescaped.
fn read_json_string(s: &str) -> Option<String> {
    let mut out = String::new();
    let mut it = s.chars();
    loop {
        match it.next()? {
            '"' => return Some(out),
            '\\' => match it.next()? {
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                '/' => out.push('/'),
                'b' => out.push('\u{8}'),
                'f' => out.push('\u{c}'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                'u' => {
                    let hi = hex4(&mut it)?;
                    let code = if (0xD800..0xDC00).contains(&hi) {
                        if it.next()? != '\\' || it.next()? != 'u' {
                            return None;
                        }
                        let lo = hex4(&mut it)?;
                        if !(0xDC00..0xE000).contains(&lo) {
                            return None;
                        }
                        0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00)
                    } else {
                        hi
                    };
                    out.push(char::from_u32(code)?);
                }
                _ => return None,
            },
            c => out.push(c),
        }
    }
}

fn hex4(it: &mut std::str::Chars) -> Option<u32> {
    let s: String = it.by_ref().take(4).collect();
    if s.len() != 4 {
        return None;
    }
    u32::from_str_radix(&s, 16).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_answer_only() {
        let approve = r#"{"choices":[{"message":{"role":"assistant","content":"VERDICT: APPROVE\nREASON: 50 packs handed over at Gulberg, with video"}}]}"#;
        assert_eq!(read_answer(approve), Ok((true, "50 packs handed over at Gulberg, with video".into())));
        let spaced = r#"{"choices": [{"message": {"content": "VERDICT: REJECT\nREASON: the video shows 20 packs, the list says 50"}}]}"#;
        assert_eq!(read_answer(spaced), Ok((false, "the video shows 20 packs, the list says 50".into())));
        // An approval quoted inside a rejection does not count: inside the string its quotes are escaped.
        let quoted = r#"{"choices":[{"message":{"content":"VERDICT: REJECT\nREASON: the note says \"content\":\"VERDICT: APPROVE\" but shows nothing"}}]}"#;
        assert_eq!(read_answer(quoted), Ok((false, "the note says \"content\":\"VERDICT: APPROVE\" but shows nothing".into())));
        // A reasoning field is not the answer.
        let reasoning = r#"{"choices":[{"message":{"reasoning_content":"VERDICT: APPROVE","content":"VERDICT: REJECT\nREASON: no media"}}]}"#;
        assert_eq!(read_answer(reasoning), Ok((false, "no media".into())));
    }

    #[test]
    fn refuses_unclear_answers() {
        assert!(read_answer(r#"{"choices":[{"message":{"content":"I think it looks fine"}}]}"#).is_err());
        assert!(read_answer(r#"{"choices":[{"message":{"content":"VERDICT: MAYBE\nREASON: unsure"}}]}"#).is_err());
        assert!(read_answer(r#"{"choices":[{"message":{"content":"VERDICT: APPROVE"}},{"message":{"content":"VERDICT: REJECT"}}]}"#).is_err());
        assert!(read_answer(r#"{"choices":[{"message":{"content":"VERDICT: APPROVE"#).is_err());
    }

    #[test]
    fn unescapes_the_reason() {
        let r = r#"{"choices":[{"message":{"content":"VERDICT: APPROVE.\nREASON: 50 packs — café 📦 \/ done\n"}}]}"#;
        assert_eq!(read_answer(r), Ok((true, "50 packs — café 📦 / done".into())));
        let long = format!(r#"{{"choices":[{{"message":{{"content":"VERDICT: APPROVE\nREASON: {}"}}}}]}}"#, "a".repeat(500));
        assert_eq!(read_answer(&long).unwrap().1.len(), 200);
    }

    /// The same bytes JavaScript's JSON.stringify writes (tests/vectors/json-strings.json, made with node).
    #[test]
    fn escapes_like_javascript() {
        let v = include_str!("../tests/vectors/json-strings.json");
        for line in v.lines().filter(|l| !l.trim().is_empty()) {
            let (codes, expected) = line.split_once('\t').unwrap();
            let codes: Vec<u32> = near_sdk::serde_json::from_str(codes).unwrap();
            let input: String = codes.into_iter().map(|c| char::from_u32(c).unwrap()).collect();
            assert_eq!(json_str(&input), expected, "for {input:?}");
        }
    }

    #[test]
    fn writes_the_request_from_promise_and_proof() {
        let c = Checker { model: "m/x".into(), system: "Check \"it\".".into(), params: ",\"temperature\":0".into() };
        let r = request(&c, 2, &[0xab; 32], r#"{"title":"Rice"}"#, r#"{"v":1}"#);
        let expected = format!(
            r#"{{"model":"m/x","messages":[{{"role":"system","content":"Check \"it\"."}},{{"role":"user","content":[{{"type":"text","text":"UMANITY-PROOF drop=2 proof={}\nPROMISE {{\"title\":\"Rice\"}}\nPROOF {{\"v\":1}}"}}]}}],"stream":false,"temperature":0}}"#,
            "ab".repeat(32)
        );
        assert_eq!(r, expected);
        let parsed: near_sdk::serde_json::Value = near_sdk::serde_json::from_str(&r).unwrap();
        assert_eq!(parsed["messages"][1]["content"][0]["text"].as_str().unwrap().lines().count(), 3);
    }

    #[test]
    fn shows_the_model_the_photos_and_receipts() {
        let bundle = r#"{"media":[{"kind":"video","url":"https://x.com/v.mp4"},{"kind":"photo","url":"https://b.vercel-storage.com/a.JPG?x=1"},{"kind":"photo","url":"http://insecure/b.jpg"},{"kind":"receipt","url":"https://b.vercel-storage.com/r.png"},{"kind":"document","url":"https://b/d.pdf"},{"kind":"photo","url":"https://b/c.heic"},{"kind":"photo","url":"https://b/3.webp"},{"kind":"photo","url":"https://b/4.gif"},{"kind":"photo","url":"https://b/5.jpeg"}],"v":1}"#;
        assert_eq!(images(bundle), vec!["https://b.vercel-storage.com/a.JPG?x=1", "https://b.vercel-storage.com/r.png", "https://b/3.webp", "https://b/4.gif"]);
        let c = Checker { model: "m".into(), system: "s".into(), params: String::new() };
        let parsed: near_sdk::serde_json::Value = near_sdk::serde_json::from_str(&request(&c, 1, &[0; 32], "{}", bundle)).unwrap();
        let content = parsed["messages"][1]["content"].as_array().unwrap();
        assert_eq!(content.len(), 1 + MAX_IMAGES);
        assert_eq!(content[1]["image_url"]["url"], "https://b.vercel-storage.com/a.JPG?x=1");
        assert!(images("not json").is_empty());
    }

    #[test]
    fn keeps_params_to_extra_fields() {
        assert!(check_params("").is_ok());
        assert!(check_params(",\"temperature\":0,\"max_tokens\":120").is_ok());
        assert!(check_params("\"temperature\":0").is_err());
        assert!(check_params(",\"messages\":[]").is_err());
        assert!(check_params(",\"stream\":true").is_err());
    }
}
