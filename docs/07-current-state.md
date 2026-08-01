# Context Capital — current state & architecture

**Status:** private, research / PoC. Live on Solana devnet. Demand unproven (by design — see §6).
**This doc supersedes the framing in `00`–`04`**, which are kept as the design record.

## 1. What it is now

A **cross-VM re-execution validator** that issues **verified work records for AI
agents**. "LinkedIn for AI agents," where *verified* = a metric independently
**re-computed from the committed deliverable**, not self-reported reputation or
feedback.

Evolution from the original docs: the project began as a "verified execution
credential" for AI-assisted **web production** (docs 00–04). Two findings moved it:

1. A beachhead scoring ranked web production near the bottom — after redaction its
   value collapses to a generic checklist. **AI software engineering (PR/bug-fix)**
   and **smart-contract remediation** rank far higher (code/tests are inherently
   machine-verifiable and survive redaction).
2. The subject shifted from the human maker to the **AI agent** itself — the
   stronger, more differentiated wedge (buyer = agent marketplaces), matching the
   original "agents get a job history" pillar.

## 2. Architecture

**Engine (`src/`, TypeScript).**
`RawTrace → redact → independent re-compute → Receipt (2 signatures) → verify.`
- **Redaction** is fail-closed: raw prompts, client data, keys, and proprietary
  source never reach the Receipt. Structural fields are validated to a shape;
  free labels are bounded; a final scan blocks any residual secret.
- **Re-compute adapters:** `web` (Lighthouse-style HTML checks) and `swe` (re-run
  the committed test suite / exploit PoC in an isolated process).
- **Receipt** carries a salt commitment and **two signatures**: the independent
  **verifier** attests the recomputed facts; the **agent's own key** attests
  authorship (anti-impersonation — a credential can't be grafted onto an agent's
  identity without its key). Wire format is pinned to canonical JSON.
- **Résumé:** receipts aggregate by `agentKey` into a verified track record
  (`renderProfile` → `out/profile.html`).

**EVM arm (`onchain/`, Foundry).** A minimal faithful ERC-8004 Identity +
Validation registry. The validator posts `validationResponse(requestHash,
response, responseURI, responseHash, tag)`; the on-chain `responseHash` is a real
Context Capital receipt commitment. Flagship: contract remediation (exploit PoC
now fails + invariants hold).

**SVM arm (`onchain-svm/`, Rust/LiteSVM/Pinocchio).**
- `recompute_svm` — deterministic LiteSVM replay of a committed transaction vs a
  committed account snapshot (same stack as reckn's `reexec-svm`).
- **Invariant re-execution** — re-runs a committed Solana *program* (a vault BPF)
  and checks invariants (`balance ≤ deposited`; over-withdraw rejected). This is
  the solinv / low-level-SVM edge; the SVM analog of the EVM contract-remediation
  flagship.
- A **Pinocchio BPF Validation program** records the result on-chain (mirror of
  `ValidationRegistry.sol`).

## 3. Positioning (from two deep-research passes)

- **ERC-8004** (EVM) went live on mainnet Feb 2026 with Identity / Reputation /
  Validation registries. The **Validation Registry is a clean plug-in surface**
  (`validationRequest` → `validationResponse`, commitments on-chain, evidence
  off-chain) and explicitly names "stake-secured re-execution" as a validator
  type — but it is the least-mature registry (no confirmed mainnet deployment as
  of mid-2026, no staking primitive) and deployed Validation is TEE/ZK identity
  attestation, **not deliverable re-execution**.
- **Solana Agent Registry** (third-party ports: QuantuLabs `8004-solana`,
  Metaplex) mirrors the three registries — but the live port **removed the
  Validation module entirely** ("archived for future upgrade"). An even cleaner
  white space than EVM.
- **Reputation is crowded and broken** (Imperial study: forgeable for ~$0.005,
  Sybil-dominated) → the strongest case for proof-based re-execution.
- **Differentiator:** independent **deliverable re-execution**, **cross-VM**,
  leaning on SVM depth incumbents lack. **Absorption risk:** re-execution could be
  commoditized as one input to a reputation score (Score.Kred already lists it),
  or a well-capitalized player (EigenAI's optimistic re-execution + slashing)
  could extend to deliverables. The counter is the portable, key-bound
  **two-signature résumé** as a standalone credential, not one signal in a score.

## 4. What's live

Solana devnet (2026-08-01) — see `onchain-svm/DEPLOYMENTS.md`:
- Validation program `BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE`
- validationResponse tx `1Bwq…TvAT` → record `DJj8…xgtb` (`response=100`,
  `responseHash=b61a…53a9`, a real re-execution commitment).

Tests: 57 (engine) + 3 (EVM Foundry) + 6 (SVM cargo), all green.

## 5. Beachheads & buyers

1. **AI software engineering** — buyer: agent marketplaces / orchestrators; the
   pain ("which agent do I trust for real work, not benchmark theater") is live.
2. **Smart-contract / security remediation** — credibility-dense, best SVM fit.

## 6. The stacked bets (compass, not gate)

Agent adoption exploding is near-inevitable (a). It does **not** automatically
transfer to: (b) agents need *verifiable* work records vs attestation being
enough; (c) the verification is *re-execution* vs cheaper TEE/ZK winning; (d) it
settles on the *on-chain Validation* layer. Build ahead (the primitive is empty
now and the edge is ours), but watch leading indicators for b/c/d: high-stakes
agent-delivery disputes, marketplaces requiring validation, incumbents moving into
deliverable re-execution (threat *and* demand signal).

## 7. Roadmap

- EVM testnet broadcast (Base Sepolia) for a symmetric on-chain artifact.
- Demand compass: put the devnet artifact + résumé + "Validation empty / reputation
  broken" evidence in front of agent-marketplace / ERC-8004 builders — is anyone
  requesting and paying for a `validationResponse`?
- Deepen: wire solinv's real invariant catalog into SVM re-execution.

## 8. Honest scope

No investment, tokens, escrow, lending, or promise of returns. The secret-free
guarantee covers customer/execution-derived data; maker-authored public labels are
bounded and reviewed. On-chain carries only commitments; evidence stays off-chain.
Demand is the binding unknown.
