//! Context Capital — minimal Solana Validation record program (Pinocchio).
//!
//! The on-chain surface where a re-execution validator records a
//! `validationResponse` for an agent's job — the Solana arm mirror of the EVM
//! `ValidationRegistry`. Only lightweight commitments live on-chain: a 0–100
//! score, a 32-byte responseHash (the re-execution commitment from
//! `recompute_svm`), and a tag; the full evidence stays off-chain.
//!
//! Minimal by design: the client pre-creates the (program-owned) record account
//! in the same transaction, so this program only records — no PDA/CPI plumbing.
//! Write-once + validator-signer give the core integrity properties.

#![cfg_attr(not(test), no_std)]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey,
    sysvars::clock::Clock, sysvars::Sysvar, ProgramResult,
};

pinocchio::program_entrypoint!(process_instruction);
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

/// Record layout: validator(32) agent_id(8) response(1) response_hash(32) tag(32) slot(8) = 113.
pub const RECORD_LEN: usize = 113;
/// Instruction selector.
pub const IX_RECORD_VALIDATION: u8 = 0;
/// Already-written record.
pub const ERR_ALREADY_RECORDED: u32 = 0x9001;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (selector, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    if *selector != IX_RECORD_VALIDATION {
        return Err(ProgramError::InvalidInstructionData);
    }
    // rest = agent_id(8) response(1) response_hash(32) tag(32) = 73
    if rest.len() < 73 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let validator = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let record = accounts.get(1).ok_or(ProgramError::NotEnoughAccountKeys)?;

    if !validator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !record.is_writable() {
        return Err(ProgramError::InvalidArgument);
    }
    if !record.is_owned_by(program_id) {
        return Err(ProgramError::IllegalOwner);
    }

    let mut buf = record.try_borrow_mut_data()?;
    if buf.len() < RECORD_LEN {
        return Err(ProgramError::AccountDataTooSmall);
    }
    // Write-once: a non-zero validator field means this record was already set.
    if buf[..32].iter().any(|b| *b != 0) {
        return Err(ProgramError::Custom(ERR_ALREADY_RECORDED));
    }

    let response = rest[8];
    if response > 100 {
        return Err(ProgramError::InvalidInstructionData);
    }

    buf[0..32].copy_from_slice(validator.key());
    buf[32..40].copy_from_slice(&rest[0..8]); // agent_id
    buf[40] = response;
    buf[41..73].copy_from_slice(&rest[9..41]); // response_hash
    buf[73..105].copy_from_slice(&rest[41..73]); // tag
    buf[105..113].copy_from_slice(&Clock::get()?.slot.to_le_bytes());
    Ok(())
}
