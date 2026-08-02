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

## Landing page (`web/index.html`)

A single self-contained page — the public face of Rexo. It **leads with proof, not
claims**: the hero re-executes a committed deliverable *live in your browser* (real
tests + real SHA-256 + the correctness tier, including the held-out-FAILED case),
and links a **real devnet record you can read back without keys**. One genuinely
verified record (reckn-R1) is front-and-centre; the "search & hire" directory is
labelled illustrative (sample agents are examples, not real accounts — Rexo does
not fabricate track records). Host it on any static host (see [`web/README.md`](web/README.md)).

## Cross-VM arms

| | EVM — `onchain/` | Solana — `onchain-svm/` |
|---|---|---|
| Re-execute | committed test suite / exploit PoC (Foundry) | committed program in LiteSVM + invariants (solinv-style) |
| Flagship | contract remediation: exploit closed + invariants hold | vault fix: over-withdraw rejected, `balance ≤ deposited` |
| On-chain | ERC-8004 `ValidationRegistry` — `validationResponse` | Pinocchio BPF Validation program — validation record |

## Live on Solana devnet — the held-out tier is on-chain

The cross-VM validator is live on-chain, not just in tests, and it carries the
**held-out correctness tier** (see below) in the standard ERC-8004 fields:

- Validation program: [`BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE`](https://explorer.solana.com/address/BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE?cluster=devnet)
- `held-out-verified` validationResponse [tx `3gbq…ti71`](https://explorer.solana.com/tx/3gbqrpxxHtCgxk2D6RJkkXaLEw5j9btiUgovP1yqDRBe1CCQm2HWGbisgSHNUCA6JB26tEs8NeAihCWmjJ22ti71?cluster=devnet)
  → record [`Ebqs…8rsp`](https://explorer.solana.com/address/Ebqsseoy4oCx2DQopDujsjWREHXc6wjUhUPDApiJ8rsp?cluster=devnet), `response=100`, `tag="held-out-verified"`,
  `responseHash = 32d758f6…711f220` — a **reproducible** commitment to the
  re-execution facts (reckn-R1: committed 4/4 + independent held-out 4/4).
  Regenerate with `node onchain-svm/scripts/compute-tier.mjs fixtures/reckn-r1-heldout`.
  See [`onchain-svm/DEPLOYMENTS.md`](onchain-svm/DEPLOYMENTS.md).

**Held-out correctness tier.** Re-running an agent's *own* committed tests is
self-graded — an empirical study found ~28.4% of tests-passing patches are
actually wrong (UTBoost, ACL 2025). So Rexo also runs an **independent held-out
suite** (authored by the task issuer, unseen by the agent) and encodes the tier
into `response` / `tag`: `held-out-verified` → 100, `committed-only` → 70,
`held-out-FAILED` → 0. The EVM test proves the honest half on-chain — a
wrong-but-passing patch records `response=0`, never a cosmetic 100.

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
  + résumé render, CLI. **61 tests.**
- `onchain/` — EVM ERC-8004 Validation PoC (Foundry): `ValidationRegistry.sol` +
  4 tests (both correctness tiers on-chain) + testnet broadcast script. → [README](onchain/README.md)
- `onchain-svm/` — Solana re-execution validator: LiteSVM re-exec, a Pinocchio
  BPF Validation program, solinv-style invariant re-exec, devnet deploy. **6 tests.**
  `scripts/` — `compute-tier.mjs` (derive the on-chain tier), `read-record.mjs`
  (keyless read-back), `post-validation-devnet.mjs` (post a tier).
  → [README](onchain-svm/README.md) · [DEPLOYMENTS](onchain-svm/DEPLOYMENTS.md)
- `fixtures/` — real & synthetic deliverables: `reckn-r1-bundle` / `reckn-r1-heldout`
  (a real merged fix from `psyto/reckn`, + its independent held-out suite),
  `swe-heldout-catch` (a wrong-but-passing patch the held-out catches).
- `web/` — the public landing page (`index.html`, self-contained, hostable on any
  static host). The hero **re-executes a deliverable live in the browser** and links
  the real devnet record; the search/hire directory is clearly labeled illustrative.
  → [README](web/README.md)
- `docs/` — current state + the design record.

## Quickstart

Clone and run the whole thing locally — no keys, no network needed (Node 20+).

```
git clone https://github.com/psyto/rexo && cd rexo
npm install
npm test                                                     # engine — 61 tests

# 1. Build a publish-safe Receipt from a committed SWE deliverable, then verify it
npm run build:receipt -- --fixture fixtures/raw-trace-swe.json   # → out/receipt.{json,html}
npm run verify:receipt                                       # independent re-check → all PASS
open out/receipt.html                                        # the credential (macOS; else your browser)

# 2. Aggregate an agent's jobs into a key-bound résumé
npm run profile                                              # → out/profile.html

# 3. Derive the held-out correctness tier the chain records (re-runs both suites)
node onchain-svm/scripts/compute-tier.mjs fixtures/reckn-r1-heldout   # → held-out-verified, response 100
node onchain-svm/scripts/compute-tier.mjs fixtures/swe-heldout-catch  # → held-out-FAILED,   response 0

# 4. On-chain arms
npm run onchain:test                                         # EVM ERC-8004 Validation — 4 tests (both tiers on-chain)
cd onchain-svm && cargo test                                 # SVM re-exec + invariants + on-chain record — 6 tests
```

Everything above is offline and deterministic. Broadcasting to a real network
(Solana devnet / an EVM testnet) additionally needs a funded keypair — see
[`onchain-svm/DEPLOYMENTS.md`](onchain-svm/DEPLOYMENTS.md). The live devnet record
is already posted (above), so you can also just **read it back** without any keys:

```
# reads the on-chain record: owner = Validation program, response 100, tag "held-out-verified"
node onchain-svm/scripts/read-record.mjs Ebqsseoy4oCx2DQopDujsjWREHXc6wjUhUPDApiJ8rsp
```

## Status & honest scope

Public, research / PoC stage. The mechanism is real, runs locally from a clone,
and is **live on devnet** (the tier read-back above needs no keys). It is **not a
hosted product** — there is no website to submit an agent's job to yet; a developer
runs the engine themselves. **Demand is unproven** — who requests and pays for
on-chain deliverable validation is the open question. Building ahead of that demand is deliberate: the Validation
layer is empty now, and owning the cross-VM re-execution primitive before the
agent wave is the timing bet. No investment, tokens, escrow, or lending.

## Docs

- **[Current state & architecture](docs/07-current-state.md)** ← start here
- Design record (evolving, earliest → latest): [00 credential-layer MVP](docs/00-credential-layer-mvp.md) ·
  [01 PRD](docs/01-product-requirements.md) · [02 technical](docs/02-technical-requirements.md) ·
  [03 AI-dev guide](docs/03-ai-development-guide.md) · [04 plan](docs/04-implementation-plan.md) ·
  [05 review log](docs/05-review-log.md) · [06 maker test](docs/06-maker-test-howto.md)
