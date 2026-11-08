//! Reads a serialized Solana transaction message and decides whether the
//! guard may ask NEAR's MPC network to sign it.
//!
//! The release key that NEAR holds can unlock a Umanity pot, so the guard must
//! only ever sign one shape of message: a legacy message whose instructions are
//! compute-budget settings plus exactly one `unlock(proof_hash)` of the
//! Umanity program, for a drop the guard knows, with the release key as a
//! read-only signer that does not pay fees. The checker returns the proof the
//! unlock names, and the guard signs only if that proof has an approved,
//! unvetoed verdict. Anything else is refused before any signature is requested.

/// Anchor's discriminator for `unlock`: sha256("global:unlock")[..8].
pub const UNLOCK_DISCRIMINATOR: [u8; 8] = [101, 155, 40, 21, 158, 189, 56, 203];

/// ComputeBudget111111111111111111111111111111
pub const COMPUTE_BUDGET_PROGRAM: [u8; 32] = [
    3, 6, 70, 111, 229, 33, 23, 50, 255, 236, 173, 186, 114, 195, 155, 231, 188, 140, 229, 187, 197, 247, 18, 107, 44, 67, 155, 58, 64, 0, 0, 0,
];

/// The most the MPC network signs for Ed25519, and the size of a Solana packet.
pub const MAX_MESSAGE: usize = 1232;

/// `unlock` accounts, in the order the program declares them.
const UNLOCK_ACCOUNTS: usize = 8;
const DROP_INDEX: usize = 1;
const RELEASE_AUTHORITY_INDEX: usize = 5;

#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    Malformed(&'static str),
    VersionedMessage,
    NoUnlock,
    ExtraInstruction,
    WrongDrop,
    ReleaseKeyNotSigner,
    ReleaseKeyWritable,
    ReleaseKeyPaysFees,
    ReleaseKeyMisplaced,
}

impl Refusal {
    pub fn message(&self) -> &'static str {
        match self {
            Refusal::Malformed(why) => why,
            Refusal::VersionedMessage => "only legacy Solana messages are signed",
            Refusal::NoUnlock => "the message has no Umanity unlock",
            Refusal::ExtraInstruction => "the message does more than set compute budget and unlock one drop",
            Refusal::WrongDrop => "the unlock is for a different drop",
            Refusal::ReleaseKeyNotSigner => "the release key is not a signer of this message",
            Refusal::ReleaseKeyWritable => "the release key must be a read-only signer",
            Refusal::ReleaseKeyPaysFees => "the release key cannot be the fee payer",
            Refusal::ReleaseKeyMisplaced => "the release key is not the unlock's release authority",
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn u8(&mut self) -> Result<u8, Refusal> {
        let b = *self.bytes.get(self.at).ok_or(Refusal::Malformed("the message ends early"))?;
        self.at += 1;
        Ok(b)
    }

    /// Solana's compact-u16 ("shortvec") length prefix.
    fn compact_u16(&mut self) -> Result<usize, Refusal> {
        let mut value: usize = 0;
        for shift in [0u32, 7, 14] {
            let b = self.u8()? as usize;
            value |= (b & 0x7f) << shift;
            if b & 0x80 == 0 {
                return Ok(value);
            }
        }
        Err(Refusal::Malformed("a length prefix is too long"))
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], Refusal> {
        let end = self.at.checked_add(n).ok_or(Refusal::Malformed("a length overflows"))?;
        let s = self.bytes.get(self.at..end).ok_or(Refusal::Malformed("the message ends early"))?;
        self.at = end;
        Ok(s)
    }

    fn key(&mut self) -> Result<[u8; 32], Refusal> {
        let mut k = [0u8; 32];
        k.copy_from_slice(self.take(32)?);
        Ok(k)
    }
}

struct Instruction<'a> {
    program: usize,
    accounts: &'a [u8],
    data: &'a [u8],
}

/// What a valid release message unlocks.
#[derive(Debug, PartialEq, Eq)]
pub struct Release {
    pub drop: [u8; 32],
    pub proof: [u8; 32],
}

/// Checks `message` (the bytes a Solana signer signs) and returns the drop and proof it unlocks.
pub fn check_release(message: &[u8], program: &[u8; 32], release_key: &[u8; 32], drop: &[u8; 32]) -> Result<Release, Refusal> {
    if message.len() > MAX_MESSAGE {
        return Err(Refusal::Malformed("the message is longer than a Solana packet"));
    }
    let mut r = Reader { bytes: message, at: 0 };
    let required = r.u8()? as usize;
    if required & 0x80 != 0 {
        return Err(Refusal::VersionedMessage);
    }
    let readonly_signed = r.u8()? as usize;
    let readonly_unsigned = r.u8()? as usize;
    let key_count = r.compact_u16()?;
    if key_count == 0 || required == 0 || required > key_count || readonly_signed >= required || readonly_unsigned > key_count - required {
        return Err(Refusal::Malformed("the message header does not fit its accounts"));
    }
    let mut keys = Vec::with_capacity(key_count);
    for _ in 0..key_count {
        keys.push(r.key()?);
    }
    let _blockhash = r.take(32)?;
    let ix_count = r.compact_u16()?;
    let mut instructions = Vec::with_capacity(ix_count);
    for _ in 0..ix_count {
        let program = r.u8()? as usize;
        let n = r.compact_u16()?;
        let accounts = r.take(n)?;
        let len = r.compact_u16()?;
        let data = r.take(len)?;
        if program >= key_count || accounts.iter().any(|&a| a as usize >= key_count) {
            return Err(Refusal::Malformed("an instruction points past the account list"));
        }
        instructions.push(Instruction { program, accounts, data });
    }
    if r.at != message.len() {
        return Err(Refusal::Malformed("bytes follow the instructions"));
    }

    // Where the release key sits decides what it may do: it must sign, must not be writable, must not pay.
    let release_at = keys.iter().position(|k| k == release_key).ok_or(Refusal::ReleaseKeyNotSigner)?;
    if release_at >= required {
        return Err(Refusal::ReleaseKeyNotSigner);
    }
    if release_at == 0 {
        return Err(Refusal::ReleaseKeyPaysFees);
    }
    if release_at < required - readonly_signed {
        return Err(Refusal::ReleaseKeyWritable);
    }

    let mut unlock: Option<&Instruction> = None;
    for ix in &instructions {
        let id = &keys[ix.program];
        if id == &COMPUTE_BUDGET_PROGRAM && ix.accounts.is_empty() {
            continue;
        }
        if id == program && unlock.is_none() {
            unlock = Some(ix);
            continue;
        }
        return Err(Refusal::ExtraInstruction);
    }
    let ix = unlock.ok_or(Refusal::NoUnlock)?;
    if ix.data.len() != 8 + 32 || ix.data[..8] != UNLOCK_DISCRIMINATOR {
        return Err(Refusal::NoUnlock);
    }
    if ix.accounts.len() != UNLOCK_ACCOUNTS {
        return Err(Refusal::Malformed("the unlock has the wrong number of accounts"));
    }
    if &keys[ix.accounts[DROP_INDEX] as usize] != drop {
        return Err(Refusal::WrongDrop);
    }
    if ix.accounts[RELEASE_AUTHORITY_INDEX] as usize != release_at {
        return Err(Refusal::ReleaseKeyMisplaced);
    }
    let mut p = [0u8; 32];
    p.copy_from_slice(&ix.data[8..]);
    Ok(Release { drop: *drop, proof: p })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROGRAM: [u8; 32] = [7u8; 32];
    const RELEASE: [u8; 32] = [9u8; 32];
    const DROP: [u8; 32] = [4u8; 32];
    const PROOF: [u8; 32] = [5u8; 32];
    const PAYER: [u8; 32] = [1u8; 32];

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

    /// keys: [payer (writable signer), release (readonly signer), drop, pot, payee, payee_usdc, config, mint, token, program, (compute budget)]
    fn message(header: [u8; 3], keys: &[[u8; 32]], ixs: &[(u8, Vec<u8>, Vec<u8>)]) -> Vec<u8> {
        let mut m = header.to_vec();
        compact(keys.len(), &mut m);
        for k in keys {
            m.extend_from_slice(k);
        }
        m.extend_from_slice(&[2u8; 32]);
        compact(ixs.len(), &mut m);
        for (p, accts, data) in ixs {
            m.push(*p);
            compact(accts.len(), &mut m);
            m.extend_from_slice(accts);
            compact(data.len(), &mut m);
            m.extend_from_slice(data);
        }
        m
    }

    fn unlock_data(proof: [u8; 32]) -> Vec<u8> {
        let mut d = UNLOCK_DISCRIMINATOR.to_vec();
        d.extend_from_slice(&proof);
        d
    }

    fn keys() -> Vec<[u8; 32]> {
        vec![PAYER, RELEASE, DROP, [10u8; 32], [11u8; 32], [12u8; 32], [13u8; 32], [14u8; 32], [15u8; 32], PROGRAM, COMPUTE_BUDGET_PROGRAM]
    }

    // config 6, drop 2, pot 3, payee 11?, keep indexes explicit
    fn unlock_accounts() -> Vec<u8> {
        vec![6, 2, 3, 4, 5, 1, 7, 8]
    }

    fn good() -> Vec<u8> {
        // 2 signers (payer writable, release readonly), 8 readonly unsigned (config, mint, token, program, budget, payee...)
        message([2, 1, 6], &keys(), &[(10, vec![], vec![2, 0, 0, 0, 0]), (9, unlock_accounts(), unlock_data(PROOF))])
    }

    #[test]
    fn accepts_one_unlock_with_compute_budget_and_reads_its_proof() {
        assert_eq!(check_release(&good(), &PROGRAM, &RELEASE, &DROP), Ok(Release { drop: DROP, proof: PROOF }));
        let other = message([2, 1, 6], &keys(), &[(9, unlock_accounts(), unlock_data([6u8; 32]))]);
        assert_eq!(check_release(&other, &PROGRAM, &RELEASE, &DROP), Ok(Release { drop: DROP, proof: [6u8; 32] }));
    }

    #[test]
    fn refuses_another_drop() {
        assert_eq!(check_release(&good(), &PROGRAM, &RELEASE, &[8u8; 32]), Err(Refusal::WrongDrop));
    }

    #[test]
    fn refuses_a_message_longer_than_a_packet() {
        let mut long = good();
        long.resize(MAX_MESSAGE + 1, 0);
        assert!(matches!(check_release(&long, &PROGRAM, &RELEASE, &DROP), Err(Refusal::Malformed(_))));
    }

    #[test]
    fn refuses_a_second_instruction() {
        let m = message([2, 1, 6], &keys(), &[(9, unlock_accounts(), unlock_data(PROOF)), (9, unlock_accounts(), unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ExtraInstruction));
        // A "compute budget" instruction that touches accounts is not a compute budget setting.
        let m = message([2, 1, 6], &keys(), &[(10, vec![1], vec![]), (9, unlock_accounts(), unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ExtraInstruction));
    }

    #[test]
    fn refuses_a_writable_or_paying_release_key() {
        // release key writable: 2 signers, 0 readonly signed
        let m = message([2, 0, 6], &keys(), &[(9, unlock_accounts(), unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ReleaseKeyWritable));
        // release key as fee payer
        let mut k = keys();
        k.swap(0, 1);
        let m = message([2, 1, 6], &k, &[(9, vec![6, 2, 3, 4, 5, 0, 7, 8], unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ReleaseKeyPaysFees));
        // release key not a signer at all
        let m = message([1, 0, 6], &keys(), &[(9, unlock_accounts(), unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ReleaseKeyNotSigner));
    }

    #[test]
    fn refuses_a_release_key_in_another_slot() {
        // the release key signs, but the unlock names the payer as its release authority
        let m = message([2, 1, 6], &keys(), &[(9, vec![6, 2, 3, 4, 5, 0, 7, 8], unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ReleaseKeyMisplaced));
    }

    #[test]
    fn refuses_other_programs_and_instructions() {
        let mut other = unlock_data(PROOF);
        other[0] ^= 1;
        let m = message([2, 1, 6], &keys(), &[(9, unlock_accounts(), other)]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::NoUnlock));
        let m = message([2, 1, 6], &keys(), &[(8, unlock_accounts(), unlock_data(PROOF))]);
        assert_eq!(check_release(&m, &PROGRAM, &RELEASE, &DROP), Err(Refusal::ExtraInstruction));
    }

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }

    fn key32(s: &str) -> [u8; 32] {
        let mut k = [0u8; 32];
        k.copy_from_slice(&hex(s));
        k
    }

    /// A real message built by @solana/web3.js with the app's own unlock builder (tests/vectors).
    #[test]
    fn accepts_a_real_web3_unlock_message() {
        let v = include_str!("../tests/vectors/web3-unlock.json");
        let field = |name: &str| {
            let at = v.find(&format!("\"{}\":\"", name)).unwrap() + name.len() + 4;
            v[at..at + v[at..].find('"').unwrap()].to_string()
        };
        let program: [u8; 32] = [7, 29, 24, 6, 190, 93, 190, 6, 122, 219, 214, 105, 23, 107, 219, 230, 228, 211, 224, 186, 85, 15, 214, 117, 124, 130, 3, 18, 18, 57, 63, 154];
        let (msg, drop, release, proof) = (hex(&field("message")), key32(&field("drop")), key32(&field("release")), key32(&field("proof")));
        assert_eq!(check_release(&msg, &program, &release, &drop), Ok(Release { drop, proof }));
        // The same message is refused for another drop or another release key.
        assert_eq!(check_release(&msg, &program, &release, &[3u8; 32]), Err(Refusal::WrongDrop));
        assert_eq!(check_release(&msg, &program, &[3u8; 32], &drop), Err(Refusal::ReleaseKeyNotSigner));
    }

    #[test]
    fn refuses_versioned_truncated_and_padded_messages() {
        let mut v0 = good();
        v0.insert(0, 0x80);
        assert_eq!(check_release(&v0, &PROGRAM, &RELEASE, &DROP), Err(Refusal::VersionedMessage));
        let g = good();
        assert!(matches!(check_release(&g[..g.len() - 1], &PROGRAM, &RELEASE, &DROP), Err(Refusal::Malformed(_))));
        let mut padded = good();
        padded.push(0);
        assert!(matches!(check_release(&padded, &PROGRAM, &RELEASE, &DROP), Err(Refusal::Malformed(_))));
    }
}
