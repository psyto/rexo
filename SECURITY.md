# Security notes

**Fabricated test secrets.** Rexo is a redaction / re-execution validator. Its
`test/` and `fixtures/` intentionally contain **fake secret-shaped strings**
(API-key-shaped tokens, emails, phone numbers) so the scanner and the redaction
pipeline can be exercised. **None are real credentials.** GitHub secret scanning
may still surface them as informational alerts; `.github/secret_scanning.yml`
excludes those paths.

**Real secrets never touch the repo.** Verifier/agent keypairs, salt envelopes,
and RPC keys are device-local (`vault/`, environment variables) and git-ignored.
Published Receipts are secret-free and source-free by construction.

**Not audited.** The Solidity contracts (`onchain/`) and the Pinocchio BPF
programs (`onchain-svm/`) are research PoCs. They must receive an external
security audit before any mainnet / production use.

To report a vulnerability, open a private security advisory on the repository.
