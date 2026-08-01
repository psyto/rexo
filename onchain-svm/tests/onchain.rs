//! On-chain end-to-end: the SVM re-execution result is recorded in a real Solana
//! program (BPF-compiled, run in LiteSVM) — the Solana mirror of the EVM
//! `onchain/` validationResponse. The on-chain responseHash is the actual
//! `recompute_svm` commitment.

use cc_svm_validator::{recompute_svm, CommittedAccount, Deliverable};
use litesvm::LiteSVM;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SYSTEM: Pubkey = Pubkey::new_from_array([0u8; 32]);
const PROGRAM_ID: Pubkey = Pubkey::new_from_array([2u8; 32]);
const RECORD_LEN: u64 = 113;
const SO: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/program/target/deploy/cc_svm_validation_program.so");

fn create_account_ix(payer: &Pubkey, new: &Pubkey, lamports: u64, space: u64, owner: &Pubkey) -> Instruction {
    let mut data = 0u32.to_le_bytes().to_vec(); // SystemInstruction::CreateAccount
    data.extend_from_slice(&lamports.to_le_bytes());
    data.extend_from_slice(&space.to_le_bytes());
    data.extend_from_slice(owner.as_ref());
    Instruction {
        program_id: SYSTEM,
        accounts: vec![AccountMeta::new(*payer, true), AccountMeta::new(*new, true)],
        data,
    }
}

#[test]
fn validator_records_reexec_result_onchain() {
    // 1) produce a REAL SVM re-execution commitment (the responseHash)
    let from = Keypair::new_from_array([1u8; 32]);
    let to = Pubkey::new_from_array([9u8; 32]);
    let accounts = vec![
        CommittedAccount { pubkey: from.pubkey(), lamports: 1_000_000_000 },
        CommittedAccount { pubkey: to, lamports: 1 },
    ];
    let vr = recompute_svm(&Deliverable {
        accounts: &accounts,
        from: &from,
        to,
        amount: 2_000_000,
        predicate_account: to,
        expected_lamports: 2_000_001,
    });
    assert!(vr.reproduced(), "re-execution must reproduce");
    let response_hash = vr.commitment;

    // 2) load the real Solana program and have the validator record the result
    let mut svm = LiteSVM::new().with_blockhash_check(false);
    svm.add_program_from_file(PROGRAM_ID, SO).unwrap();
    let payer = Keypair::new(); // fee payer + the validator
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
    let record = Keypair::new();

    let create = create_account_ix(&payer.pubkey(), &record.pubkey(), 3_000_000, RECORD_LEN, &PROGRAM_ID);

    let agent_id: u64 = 42;
    let tag = *b"reexec--------------------------"; // 32 bytes
    let mut ix_data = vec![0u8]; // selector = RECORD_VALIDATION
    ix_data.extend_from_slice(&agent_id.to_le_bytes());
    ix_data.push(100); // response = passed
    ix_data.extend_from_slice(&response_hash);
    ix_data.extend_from_slice(&tag);
    let record_ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true), // validator (signer)
            AccountMeta::new(record.pubkey(), false), // record (writable)
        ],
        data: ix_data,
    };

    let mut tx = Transaction::new_with_payer(&[create, record_ix], Some(&payer.pubkey()));
    tx.sign(&[&payer, &record], Default::default());
    svm.send_transaction(tx).expect("record validation tx");

    // 3) read the on-chain record back
    let acc = svm.get_account(&record.pubkey()).expect("record account exists");
    assert!(acc.data.len() as u64 >= RECORD_LEN);
    let vpk = payer.pubkey();
    assert_eq!(&acc.data[0..32], vpk.as_ref(), "validator recorded");
    assert_eq!(&acc.data[32..40], &agent_id.to_le_bytes());
    assert_eq!(acc.data[40], 100, "response = passed");
    assert_eq!(&acc.data[41..73], &response_hash, "on-chain responseHash == re-execution commitment");
    assert_eq!(&acc.data[73..105], &tag);
}
