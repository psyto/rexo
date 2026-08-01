//! Demo agent deliverable: a minimal Solana vault (Pinocchio).
//!
//! Vault data account: `balance: u64 [0..8]`, `deposited: u64 [8..16]`.
//! Instructions: `0 = deposit(amount)`, `1 = withdraw(amount)`.
//!
//! The remediation being demonstrated: `withdraw` enforces `amount <= balance`
//! (the fix). The invariant `balance <= deposited` and "over-withdraw is
//! rejected" are what the re-execution validator re-checks — the SVM analog of
//! the EVM contract-remediation flagship, exercising the solinv-style invariant
//! re-execution edge.

#![cfg_attr(not(test), no_std)]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey, ProgramResult,
};

pinocchio::program_entrypoint!(process_instruction);
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

pub const ERR_OVER_WITHDRAW: u32 = 0x7701;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (selector, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    let vault = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !vault.is_writable() {
        return Err(ProgramError::InvalidArgument);
    }
    if !vault.is_owned_by(program_id) {
        return Err(ProgramError::IllegalOwner);
    }
    if rest.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());

    let mut buf = vault.try_borrow_mut_data()?;
    if buf.len() < 16 {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let mut balance = u64::from_le_bytes(buf[0..8].try_into().unwrap());
    let mut deposited = u64::from_le_bytes(buf[8..16].try_into().unwrap());

    match *selector {
        0 => {
            balance = balance.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
            deposited = deposited.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
        }
        1 => {
            // The fix: reject over-withdraw instead of underflowing `balance`.
            if amount > balance {
                return Err(ProgramError::Custom(ERR_OVER_WITHDRAW));
            }
            balance -= amount;
        }
        _ => return Err(ProgramError::InvalidInstructionData),
    }

    buf[0..8].copy_from_slice(&balance.to_le_bytes());
    buf[8..16].copy_from_slice(&deposited.to_le_bytes());
    Ok(())
}
