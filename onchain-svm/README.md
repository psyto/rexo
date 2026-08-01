# Context Capital — SVM (Solana) re-execution validator (PoC)

The **Solana arm** of the cross-VM re-execution validator. Together with
`../onchain` (the EVM / ERC-8004 arm) this is a position nobody occupies:
independent **deliverable re-execution** on *both* VMs — the white space both
deep-research passes confirmed (deployed Validation on EVM is TEE/ZK "who/where";
on Solana the Validation module was removed from the live registry entirely).

## What it does

`recompute_svm(deliverable)` re-executes a **committed** SVM transaction against a
**committed** account snapshot inside **LiteSVM** (deterministic, no live cluster)
and adjudicates a predicate over the post-state — the SVM analog of re-running a
committed test suite. It returns:

- a `Verdict` (Reproduced / Failed), and
- a `commitment` (sha256 over the committed prestate + transfer + predicate) —
  the `responseHash` that would be posted to a **Solana Agent Registry Validation**
  entry, exactly as the EVM arm posts to the **ERC-8004 Validation Registry**.

Uses the same LiteSVM / solana-v3 stack as the reckn `reexec-svm` backend. The
production path swaps in `reexec-svm::replay` (bank-hash-authenticated snapshots,
VM-neutral `ReplayRecordV1`) for full committed-state authenticity.

## On-chain program

`program/` is a real Solana program (Pinocchio, BPF-compiled) — the on-chain
surface where the validator **records the validationResponse**: `{validator,
agent_id, response (0–100), response_hash, tag, slot}`, write-once and
validator-signed. It is the Solana mirror of the EVM `ValidationRegistry.sol`.

## Run

```
cd onchain-svm
cargo test                                   # 4 re-execution tests
(cd program && cargo build-sbf)              # compile the Solana program → .so
cargo test --test onchain                    # 1 on-chain test (LiteSVM loads the .so)
```

- Re-execution (4): honest reproduces; false claim fails; overspend rejected by
  the runtime (balance is prestate truth); commitment deterministic.
- On-chain (1): the validator records the **real `recompute_svm` commitment** as
  the on-chain `responseHash` in the BPF program, read back and verified.

## Cross-VM position

| Arm | Where | Re-executes | Posts to |
|---|---|---|---|
| EVM (`../onchain`) | Foundry | committed test suite / exploit PoC | ERC-8004 Validation Registry |
| SVM (`onchain-svm`) | LiteSVM | committed SVM tx vs committed snapshot | Solana Agent Registry Validation |

Same engine idea (redact → independent re-compute → sign → verify), one verifier
across two VMs. The moat is the SVM re-execution depth (reexec-svm / solinv /
LiteSVM) that single-VM incumbents (EigenAI, Score.Kred) do not have.

## Honest scope

Proves the re-execution *mechanism* on Solana is real and cheap. It does not
prove demand — who requests and pays for a Solana validation is the open
question. Building ahead of that demand is deliberate: the Validation layer is
empty now, and owning the cross-VM re-execution primitive before the agent wave
is the timing bet.
