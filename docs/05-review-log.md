# Review log — Phase 0 slice

## Round 1 (Codex adversarial review, 07-31)

Seven confirmed findings, all resolved. Regression tests added for each.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Critical | `receipt.html` embedded raw prompts/inputs | Split renderers: `renderPublishedReceipt` (secret-free, the only shareable output) vs `renderLocalComparison` (raw view, written only under gitignored `vault/` via explicit `--local-preview`). |
| 2 | Critical | Unscanned public fields (`category`, `tool`, `input.kind`, attestation…) copied into `receipt.json`; CLI wrote even on privacy failure | All external strings pass `redactString`; builder runs a **fail-closed** final scan (`PrivacyGateError`) and returns nothing on residual secret; CLI refuses to write. |
| 3 | Critical | `__proto__` key bypassed canonical form → survived signature + privacy scan | `canonicalize` accumulates into `Object.create(null)` so dangerous keys are preserved, sorted, signed-over, and scanned; verifier also scans the **raw JSON bytes** (`rawJson`). |
| 4 | High | Verifier checked `artifact.checks` but the UI displayed `metrics.machineRecomputed`, which was never validated | Verifier now recomputes and requires **both** arrays to deep-equal the fresh result (name/value/unit/method/source, plus missing/extra). |
| 5 | High | `broken_relative_links` did `existsSync` on siblings outside the commitment → same bytes, different metric per machine | Replaced with pure-bytes `relative_asset_refs`. Determinism invariant documented: every check must be a pure function of the committed bytes. |
| 6 | High | Self-signed receipts; verifier trusted the key embedded in the receipt | `verifyReceipt` requires an out-of-band `trustedIssuer`; without a match `ok` is false. CLI uses the tool's `verifier-key.json` as the anchor. |
| 7 | Medium | Scanner false negatives (full-width / zero-width contacts) | NFKC normalization + invisible-char stripping before scan. Scanner is documented as defense-in-depth only. |

Result: typecheck clean, 41 tests green, CLI build/verify E2E + negative paths verified.

## Residual known limitations (not blocking Phase 0)

- **Scanner is best-effort.** It does not detect Base64/high-entropy secrets, personal names, or postal addresses. Mitigation is structural, not the scanner: the published receipt carries no arbitrary free text, external fields are redacted, and the builder fails closed. Do not rely on the scanner to make free text safe.
- **Single-file artifact commitment.** A real multi-file deliverable should commit to a bundle root (tar/zip/Merkle) and be checked inside that bundle. Phase 0 checks only the one committed HTML file.
- **Machine checks are syntactic stand-ins** for a Lighthouse/link-check runner. The `reexec-core` adapter would replace `recomputeArtifact` with the real engine; the interface is unchanged.
