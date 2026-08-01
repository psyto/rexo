//! solinv-style invariant re-execution: the validator re-runs a committed Solana
//! *program* deliverable (a vault) in LiteSVM and checks invariants over the
//! resulting state — the SVM analog of the EVM contract-remediation flagship.
//! The invariant `balance <= deposited` must hold, and the over-withdraw exploit
//! must be rejected by the (fixed) program.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SYSTEM: Pubkey = Pubkey::new_from_array([0u8; 32]);
const VAULT_ID: Pubkey = Pubkey::new_from_array([3u8; 32]);
const VAULT_SO: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/deliverable/target/deploy/cc_svm_vault_deliverable.so");

fn create_account_ix(payer: &Pubkey, new: &Pubkey, lamports: u64, space: u64, owner: &Pubkey) -> Instruction {
    let mut data = 0u32.to_le_bytes().to_vec();
    data.extend_from_slice(&lamports.to_le_bytes());
    data.extend_from_slice(&space.to_le_bytes());
    data.extend_from_slice(owner.as_ref());
    Instruction { program_id: SYSTEM, accounts: vec![AccountMeta::new(*payer, true), AccountMeta::new(*new, true)], data }
}

fn vault_ix(vault: &Pubkey, selector: u8, amount: u64) -> Instruction {
    let mut data = vec![selector];
    data.extend_from_slice(&amount.to_le_bytes());
    Instruction { program_id: VAULT_ID, accounts: vec![AccountMeta::new(*vault, false)], data }
}

fn read_u64(data: &[u8], off: usize) -> u64 {
    u64::from_le_bytes(data[off..off + 8].try_into().unwrap())
}

#[test]
fn validator_reexecutes_program_and_checks_invariants() {
    let mut svm = LiteSVM::new().with_blockhash_check(false);
    svm.add_program_from_file(VAULT_ID, VAULT_SO).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
    let vault = Keypair::new();

    // tx1: create the vault (owned by the program) + deposit(100)
    let tx1 = {
        let create = create_account_ix(&payer.pubkey(), &vault.pubkey(), 3_000_000, 16, &VAULT_ID);
        let deposit = vault_ix(&vault.pubkey(), 0, 100);
        let mut tx = Transaction::new_with_payer(&[create, deposit], Some(&payer.pubkey()));
        tx.sign(&[&payer, &vault], Default::default());
        tx
    };
    svm.send_transaction(tx1).expect("create+deposit");
    let d = svm.get_account(&vault.pubkey()).unwrap().data;
    assert_eq!(read_u64(&d, 0), 100, "balance after deposit");
    assert_eq!(read_u64(&d, 8), 100, "deposited");

    // tx2: withdraw(40) within balance
    let tx2 = {
        let mut tx = Transaction::new_with_payer(&[vault_ix(&vault.pubkey(), 1, 40)], Some(&payer.pubkey()));
        tx.sign(&[&payer], Default::default());
        tx
    };
    svm.send_transaction(tx2).expect("withdraw within balance");
    let d = svm.get_account(&vault.pubkey()).unwrap().data;
    let (balance, deposited) = (read_u64(&d, 0), read_u64(&d, 8));
    assert_eq!(balance, 60);
    assert!(balance <= deposited, "INVARIANT balance <= deposited");

    // tx3: over-withdraw(1000) — the exploit. The fixed program MUST reject it.
    let tx3 = {
        let mut tx = Transaction::new_with_payer(&[vault_ix(&vault.pubkey(), 1, 1000)], Some(&payer.pubkey()));
        tx.sign(&[&payer], Default::default());
        tx
    };
    let exploit = svm.send_transaction(tx3);
    assert!(exploit.is_err(), "over-withdraw exploit must be rejected");

    // state is unchanged and the invariant still holds after the rejected exploit
    let d = svm.get_account(&vault.pubkey()).unwrap().data;
    let (balance, deposited) = (read_u64(&d, 0), read_u64(&d, 8));
    assert_eq!(balance, 60, "state unchanged by the rejected exploit");
    assert!(balance <= deposited, "INVARIANT preserved: no underflow/over-withdraw");

    // responseHash the validator would post: binds the committed program bytes +
    // the re-executed instruction sequence + the invariant verdict.
    let mut h = Sha256::new();
    h.update(b"ccap.svm.invariants.v0");
    h.update(std::fs::read(VAULT_SO).unwrap());
    for (sel, amt) in [(0u8, 100u64), (1, 40), (1, 1000)] {
        h.update([sel]);
        h.update(amt.to_le_bytes());
    }
    h.update([1u8]); // verdict: invariants hold + exploit rejected
    let commitment: [u8; 32] = h.finalize().into();
    assert_ne!(commitment, [0u8; 32]);
}
