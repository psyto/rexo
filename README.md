# Rexo

**Verified work records for AI agents — where "verified" means independent
re-execution, not attestation or feedback.**

Think "LinkedIn for AI agents": an agent accrues a portable, key-bound track
record of jobs whose quality/outcome metrics are **independently re-computed from
the committed deliverable** (re-running the committed test suite / exploit PoC /
program), never self-reported. Rexo is a **cross-VM re-execution
validator** that plugs into the **ERC-8004** (EVM) and **Solana Agent Registry**
(SVM) Validation layers — the high-assurance tier both standards describe but
almost no one occupies.

## Why this, why now

- Agent trust today is **reputation = feedback / attestation** (who vouched, star
  ratings) — and it is empirically broken: an Imperial-led study of ERC-8004
  found reputations forgeable for ~$0.005 and Sybil-dominated (73–91% flagged).
- The **Validation** layer — independent re-execution of the *deliverable* — is
  the defensible, unoccupied white space. Deployed Validation is all TEE / ZK
  "who / where an agent ran"; **nobody re-computes the deliverable's quality**.
  On Solana the Validation module was removed from the live registry entirely.
- Rexo fills exactly that gap, **across both VMs**, leaning on deep SVM
  re-execution (LiteSVM / Pinocchio / invariant re-execution) that single-VM
  incumbents (EigenAI, Score.Kred) do not have.

## How it works (the engine)

```
RawTrace (device-local, secret-capable)
  → redact            (secret/PII scan, fail-closed; raw prompts & source never leave)
  → re-compute        (an INDEPENDENT verifier re-runs the committed deliverable)
  → Receipt           (salt commitment + TWO signatures:
                         · verifier key  — attests the recomputed facts
                         · agent's key   — attests authorship, anti-impersonation)
  → third-party verify (signatures + re-computation match + canonical wire + privacy)
```

The Receipt is **secret-free and source-free by construction** — it commits a
hash + machine-recomputed metrics, never the prompts or proprietary source — so
the credential survives redaction. Receipts aggregate **by the agent's key** into
a verified résumé (`npm run profile`).

## Cross-VM arms

| | EVM — `onchain/` | Solana — `onchain-svm/` |
|---|---|---|
| Re-execute | committed test suite / exploit PoC (Foundry) | committed program in LiteSVM + invariants (solinv-style) |
| Flagship | contract remediation: exploit closed + invariants hold | vault fix: over-withdraw rejected, `balance ≤ deposited` |
| On-chain | ERC-8004 `ValidationRegistry` — `validationResponse` | Pinocchio BPF Validation program — validation record |

## Live on Solana devnet

The cross-VM validator is live on-chain, not just in tests:

- Validation program: [`BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE`](https://explorer.solana.com/address/BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE?cluster=devnet)
- validationResponse [tx `1Bwq…TvAT`](https://explorer.solana.com/tx/1BwqHbCk3UJfXenTkGENWMHvNtkN2NeRVf8KFzzGpwaPZa5DLT1CfGVZTghnufv2jZ7AnshgoFCUodjRPfKTvAT?cluster=devnet)
  → record `DJj8…xgtb`, `response=100`, `responseHash = b61a…53a9` (a real
  Rexo re-execution commitment). See [`onchain-svm/DEPLOYMENTS.md`](onchain-svm/DEPLOYMENTS.md).

## Beachheads

Where the credential's transferable value survives redaction and demand is live:

1. **AI software engineering (PR / bug-fix)** — buyer: agent marketplaces /
   orchestrators ("which agent do I trust for real work, not benchmark theater").
2. **Smart-contract / security remediation** — best fit for the SVM / invariant edge.

(Web production is a weak fallback: once client brand/copy/secrets are redacted,
its value collapses to a generic Lighthouse checklist any linter reproduces.)

## Repo map

- `src/` — the engine (TypeScript): trace + redaction, re-compute adapters
  (`web`, `swe`), receipt build/verify (two-signature, canonical wire), credential
  + résumé render, CLI. **57 tests.**
- `onchain/` — EVM ERC-8004 Validation PoC (Foundry): `ValidationRegistry.sol` +
  3 tests + testnet broadcast script. → [README](onchain/README.md)
- `onchain-svm/` — Solana re-execution validator: LiteSVM re-exec, a Pinocchio
  BPF Validation program, solinv-style invariant re-exec, devnet deploy. **6 tests.**
  → [README](onchain-svm/README.md) · [DEPLOYMENTS](onchain-svm/DEPLOYMENTS.md)
- `fixtures/` — real & synthetic deliverables, including `reckn-r1-bundle` (a real
  merged fix from `psyto/reckn`).
- `docs/` — current state + the design record.

## Try it

```
npm test                                             # engine (57)
npm run build:receipt -- --fixture fixtures/raw-trace-swe.json   # → out/receipt.html
npm run profile                                      # → out/profile.html (agent résumé)
npm run onchain:test                                 # EVM ERC-8004 Validation
cd onchain-svm && cargo test                         # SVM re-exec + invariants + on-chain
```

## Status & honest scope

Private, research / PoC stage. The mechanism is real and **live on devnet**;
**demand is unproven** — who requests and pays for on-chain deliverable validation
is the open question. Building ahead of that demand is deliberate: the Validation
layer is empty now, and owning the cross-VM re-execution primitive before the
agent wave is the timing bet. No investment, tokens, escrow, or lending.

## Docs

- **[Current state & architecture](docs/07-current-state.md)** ← start here
- Design record (evolving, earliest → latest): [00 credential-layer MVP](docs/00-credential-layer-mvp.md) ·
  [01 PRD](docs/01-product-requirements.md) · [02 technical](docs/02-technical-requirements.md) ·
  [03 AI-dev guide](docs/03-ai-development-guide.md) · [04 plan](docs/04-implementation-plan.md) ·
  [05 review log](docs/05-review-log.md) · [06 maker test](docs/06-maker-test-howto.md)
