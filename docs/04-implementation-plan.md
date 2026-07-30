# Context Capital — MVP Implementation Plan

## Phase 0: Validate the asset (1–2 weeks)

Goal: verify that makers regard redacted execution history as a reusable asset.

- Design a Trace JSON schema and synthetic sample set.
- Build a local-only Trace viewer and Capsule draft generator.
- Interview 10 AI-assisted Web creators using their own completed work.
- Success criterion: 6 participants approve a generated Capsule after editing it.

## Phase 1: Private Capsule registry (2 weeks)

- Passkey sign-in and consent records.
- Local redaction, user review, encrypted artifact upload.
- Capsule creation, versioning, search, private / public status.
- No payment and no chain integration.

## Phase 2: Verifiable evaluation (2 weeks)

- Web-production evaluation runner.
- Reviewer queue, rubric, signed decision, dispute state machine.
- Metrics for evaluator agreement and review duration.

## Phase 3: License and transparent settlement (2–3 weeks)

- Per-use license checkout using a licensed payment provider or testnet stablecoin.
- Escrow state machine and fixed split calculation.
- Minimal chain registry containing Capsule version commitment and settlement receipt.
- End-to-end test: purchase → run → pass → dispute window → settlement.

## Phase 4: Closed pilot

- 20 Makers, 50 Capsules, 100 licensed runs.
- Weekly privacy review, manual abuse review, and support channel.
- Measure reuse, completion, disputes, value to makers, and data leakage incidents.

## Sequenced backlog

1. Repository bootstrap, CI, synthetic fixtures, threat-model document.
2. `Trace` and `Receipt` typed schema plus redaction unit tests.
3. Local vault and approval UI.
4. Capsule builder and versioned publishing API.
5. Search and transparent Capsule detail page.
6. Automated Web-production evaluator.
7. Reviewer workflow and dispute state machine.
8. License checkout and idempotent payment webhooks.
9. Onchain `CapsuleRegistry` and `LicenseEscrow` on testnet.
10. End-to-end security review and closed pilot operations.

## Kill criteria

Stop or narrow the experiment if any of the following occurs:

- Makers do not approve redacted Capsules because the valuable part cannot be separated from private context.
- Reusers cannot obtain better outcomes than generic prompting.
- Human review costs more than the license fee.
- Privacy scanners repeatedly miss real secrets.
- Disputes cannot be resolved by a bounded, explainable rule.
