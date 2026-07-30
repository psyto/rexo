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

## Round 2 (Codex re-review, 07-31)

Two findings from round 1 were not fully closed; one new key-management issue. All resolved.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Critical | Structural public strings (`capsule.id`, `event.kind`, `issuedAt`) trusted the scanner, which cannot see Base64/names/addresses | New `publish-guard.ts`: `kind` validated against an enum, `issuedAt` against strict ISO-8601, `capsule.id` against a lowercase slug, `version` numeric. Free-text labels are redacted **and** bounded (≤64 chars, no control chars). Violations throw `FieldRejectedError` (a `BuildBlockedError`) → nothing written. |
| 2 | High | Verifier used a name→value map, so a padded `machineRecomputed` array (correct row + forged duplicate) passed | `diffChecks` now rejects duplicate names and any length mismatch before per-element equality, on both claimed arrays. |
| 3 | Medium | Private signing key was written to `out/` before the privacy gate | Verifier key and salt envelope now live only in `vault/` (dir `0700`, files `0600`); `out/` holds publishable artifacts only. `verify` reads the trust anchor from `vault/verifier-key.json`. |

Result: typecheck clean, 46 tests green, E2E confirms `out/` carries no private key and `vault/` is `0600`.

## Round 3 (Codex re-review, 07-31)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Critical | `label()` still allowed short arbitrary strings (Base64/PII) as public values; `capsule.version` unbounded | `capsule.version` bounded to 1–8 digits; label max tightened to 48. **Scope decision:** shape validation cannot distinguish a short Base64 secret from a legitimate slug (both alphanumeric), so the secret-free *guarantee* is scoped to customer/execution-derived data (dropped/redacted/scanned); maker-authored labels are bounded + reviewed (NFR-04), like a résumé's free fields. An optional `allow` enum on `label()` enforces a closed vocabulary where a deployment has one. |
| 2 | Critical | Duplicate JSON key could inject a secret into signed raw bytes that a re-parse hides | Wire format pinned to canonical JSON: `build` writes `canonicalize(receipt)`; `verifyReceipt` requires `rawJson === canonicalize(receipt)` (`canonicalWire`). Any dup key / extra field / reorder / whitespace is rejected regardless of the scanner. |
| 3 | Medium | `vault/` 0700/0600 not enforced on pre-existing paths | CLI `chmod`s the vault dir and each secret file every run, and rejects symlinks. E2E: a loosened `755/644` vault is re-hardened to `700/600`; a symlinked key is refused. |

Result: typecheck clean, 49 tests green, E2E confirms canonical wire + perm re-hardening + symlink rejection.

On #1 specifically: this is the deliberate boundary of the guarantee, not an open regex war. "No customer/execution secret leaks" is provable and enforced; "a maker cannot write their own secret into their own public label" is not something any credential system proves — it is handled by the pre-publish review and, where a closed vocabulary exists, the `allow` enum.

## Residual known limitations (not blocking Phase 0)

- **Scanner is best-effort.** It does not detect Base64/high-entropy secrets, personal names, or postal addresses. Mitigation is structural: structural fields are validated to a shape, free-text labels are bounded, and the builder fails closed. Event `summary` remains maker-authored free text (redacted, reviewed before publish per NFR-04) — it is the one field where the maker is trusted not to embed their own secrets.
- **Single-file artifact commitment.** A real multi-file deliverable should commit to a bundle root (tar/zip/Merkle) and be checked inside that bundle. Phase 0 checks only the one committed HTML file.
- **Machine checks are syntactic stand-ins** for a Lighthouse/link-check runner. The `reexec-core` adapter would replace `recomputeArtifact` with the real engine; the interface is unchanged.
