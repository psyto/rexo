//! Context Capital — SVM (Solana) deliverable re-execution validator.
//!
//! The Solana arm of the cross-VM re-execution validator. It re-executes a
//! *committed* SVM transaction against a *committed* account snapshot inside
//! LiteSVM (deterministic, no live cluster) and adjudicates a predicate over the
//! post-state — the SVM analog of re-running a committed test suite. It produces
//! a `Verdict` (Reproduced / Failed) and a `commitment` that would be posted as
//! the `responseHash` to a Solana Agent Registry Validation entry, exactly as
//! the EVM arm posts to the ERC-8004 Validation Registry.
//!
//! This is a minimal faithful slice using the same LiteSVM stack as the reckn
//! `reexec-svm` backend; the production path swaps in `reexec-svm::replay`
//! (bank-hash-authenticated snapshots, VM-neutral ReplayRecordV1).

use litesvm::{AccountLoadPolicy, LiteSVM};
use sha2::{Digest, Sha256};
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SYSTEM_PROGRAM: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// A committed prestate account (system-owned, empty data) — pubkey + lamports.
#[derive(Clone)]
pub struct CommittedAccount {
    pub pubkey: Pubkey,
    pub lamports: u64,
}

/// The committed SVM deliverable: prestate + the transfer the agent claims it
/// performed + the predicate its outcome must satisfy.
pub struct Deliverable<'a> {
    pub accounts: &'a [CommittedAccount],
    /// The payer/signer (must be one of `accounts`).
    pub from: &'a Keypair,
    pub to: Pubkey,
    pub amount: u64,
    /// Whose post-state lamports the predicate checks, and the expected value.
    pub predicate_account: Pubkey,
    pub expected_lamports: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    Reproduced,
    Failed(String),
}

pub struct ValidationResult {
    pub verdict: Verdict,
    /// Binds the committed prestate + transfer + predicate — the on-chain responseHash.
    pub commitment: [u8; 32],
}

impl ValidationResult {
    pub fn reproduced(&self) -> bool {
        self.verdict == Verdict::Reproduced
    }
    pub fn commitment_hex(&self) -> String {
        let mut s = String::with_capacity(64);
        for b in self.commitment {
            s.push_str(&format!("{:02x}", b));
        }
        s
    }
}

fn system_transfer(from: &Pubkey, to: &Pubkey, lamports: u64) -> Instruction {
    let mut data = 2u32.to_le_bytes().to_vec(); // system-program Transfer discriminant
    data.extend_from_slice(&lamports.to_le_bytes());
    Instruction {
        program_id: SYSTEM_PROGRAM,
        accounts: vec![AccountMeta::new(*from, true), AccountMeta::new(*to, false)],
        data,
    }
}

fn commitment(d: &Deliverable) -> [u8; 32] {
    // Deterministic digest over the committed facts (independent of runtime
    // blockhash), so a third party recomputes the same responseHash.
    let mut h = Sha256::new();
    h.update(b"ccap.svm.v0");
    let mut accts: Vec<&CommittedAccount> = d.accounts.iter().collect();
    accts.sort_by(|a, b| a.pubkey.to_bytes().cmp(&b.pubkey.to_bytes()));
    h.update((accts.len() as u64).to_le_bytes());
    for a in accts {
        h.update(a.pubkey.to_bytes());
        h.update(a.lamports.to_le_bytes());
    }
    h.update(d.from.pubkey().to_bytes());
    h.update(d.to.to_bytes());
    h.update(d.amount.to_le_bytes());
    h.update(d.predicate_account.to_bytes());
    h.update(d.expected_lamports.to_le_bytes());
    h.finalize().into()
}

/// Re-execute the committed deliverable and adjudicate the predicate.
pub fn recompute_svm(d: &Deliverable) -> ValidationResult {
    let commitment = commitment(d);

    let mut svm = LiteSVM::new()
        .with_sigverify(true)
        .with_blockhash_check(false)
        .with_account_load_policy(AccountLoadPolicy::RejectUnseeded);

    for a in d.accounts {
        let _ = svm.set_account(
            a.pubkey,
            Account {
                lamports: a.lamports,
                data: vec![],
                owner: SYSTEM_PROGRAM,
                executable: false,
                rent_epoch: u64::MAX,
            },
        );
    }

    let ix = system_transfer(&d.from.pubkey(), &d.to, d.amount);
    let mut tx = Transaction::new_with_payer(&[ix], Some(&d.from.pubkey()));
    tx.sign(&[d.from], Default::default());

    let verdict = match svm.send_transaction(tx) {
        Ok(_) => match svm.get_account(&d.predicate_account) {
            Some(acc) if acc.lamports == d.expected_lamports => Verdict::Reproduced,
            Some(acc) => Verdict::Failed(format!(
                "lamports {} != expected {}",
                acc.lamports, d.expected_lamports
            )),
            None => Verdict::Failed("missing poststate account".to_string()),
        },
        Err(f) => Verdict::Failed(format!("execution failed: {:?}", f.err)),
    };

    ValidationResult { verdict, commitment }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kp(seed: u8) -> Keypair {
        Keypair::new_from_array([seed; 32])
    }

    #[test]
    fn honest_delivery_reproduces() {
        let from = kp(1);
        let to = Pubkey::new_from_array([9u8; 32]);
        let accounts = vec![
            CommittedAccount { pubkey: from.pubkey(), lamports: 1_000_000_000 },
            CommittedAccount { pubkey: to, lamports: 1 },
        ];
        // to starts at 1; a 2_000_000 transfer settles it at 2_000_001.
        let r = recompute_svm(&Deliverable {
            accounts: &accounts,
            from: &from,
            to,
            amount: 2_000_000,
            predicate_account: to,
            expected_lamports: 2_000_001,
        });
        assert!(r.reproduced(), "verdict: {:?}", r.verdict);
        assert_eq!(r.commitment_hex().len(), 64);
    }

    #[test]
    fn false_claim_fails() {
        let from = kp(1);
        let to = Pubkey::new_from_array([9u8; 32]);
        let accounts = vec![
            CommittedAccount { pubkey: from.pubkey(), lamports: 1_000_000_000 },
            CommittedAccount { pubkey: to, lamports: 1 },
        ];
        let r = recompute_svm(&Deliverable {
            accounts: &accounts,
            from: &from,
            to,
            amount: 2_000_000,
            predicate_account: to,
            expected_lamports: 9_999_999, // wrong
        });
        assert!(!r.reproduced());
    }

    #[test]
    fn overspend_is_rejected_by_the_runtime() {
        let from = kp(2);
        let to = Pubkey::new_from_array([7u8; 32]);
        let accounts = vec![
            CommittedAccount { pubkey: from.pubkey(), lamports: 5 }, // too little
            CommittedAccount { pubkey: to, lamports: 0 },
        ];
        let r = recompute_svm(&Deliverable {
            accounts: &accounts,
            from: &from,
            to,
            amount: 1_000_000,
            predicate_account: to,
            expected_lamports: 1_000_000,
        });
        assert!(!r.reproduced(), "overspend must fail");
    }

    #[test]
    fn commitment_is_deterministic() {
        let from = kp(1);
        let to = Pubkey::new_from_array([9u8; 32]);
        let accounts = vec![
            CommittedAccount { pubkey: from.pubkey(), lamports: 1_000_000_000 },
            CommittedAccount { pubkey: to, lamports: 1 },
        ];
        let mk = || {
            recompute_svm(&Deliverable {
                accounts: &accounts,
                from: &from,
                to,
                amount: 2_000_000,
                predicate_account: to,
                expected_lamports: 2_000_001,
            })
            .commitment
        };
        assert_eq!(mk(), mk());
    }
}
