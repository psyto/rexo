# Phase 0 — Maker demand test (how-to)

Goal: from **one real AI-assisted web job**, produce a **publish-safe verified
receipt**, show it to ~10 makers, and learn whether a redacted receipt is a
"worth-showing-to-win-work" asset — or empty once the client secrets are gone.

This is the demand gate for the whole thesis. Kill line: **fewer than 6 of 10**
say they'd use it.

## What you'll produce

- `out/receipt.html` — **safe to share.** No prompts, no client data. This is what
  you put in front of makers.
- `out/receipt.json` — the canonical, signed, verifiable receipt.
- `vault/receipt.local.html` — **device-only.** The RAW-vs-PUBLISHED comparison,
  containing the secrets. For your eyes, to confirm the redaction. Never share it.

## Steps

### 1. Pick one real completed job

Any AI-assisted site you built and delivered. You'll need its main HTML page.

### 2. Save the delivered artifact locally

The metrics are recomputed from the committed bytes of one HTML file.

```
mkdir -p fixtures/your-artifact
# save the delivered page as fixtures/your-artifact/index.html
# (e.g. open the live URL → View Source → save, or copy the built index.html)
```

Note: only that one file is hashed and measured (Phase 0 commits a single file,
not the whole bundle). Pick the main page.

### 3. Fill in the job

```
cp fixtures/your-job.template.json fixtures/your-job.json
```

Edit `fixtures/your-job.json`:
- `job.id`, `job.category` — lowercase slugs, ≤48 chars (e.g. `restaurant-lp`).
- `events[]` — your real steps. `kind` must be one of `llm_call | tool_call | edit | eval`.
  - Put the real prompts / tool I/O / client text in `rawText` — **secrets are fine
    here**, they stay in `vault/` and are redacted out.
  - `summary` on edit/eval is PUBLIC — write a secret-free one-liner.
  - `costUsd` / `durationMs` become cost/time bands.
- `inputs[]` — the brief / assets (rawText is device-local).
- `attestedMetrics[]` — real outcome numbers you can attest (e.g. CVR). These are
  shown as **client-attested / low-trust** (they can't be independently recomputed).
- `revisions` — number of revision rounds.

`fixtures/your-job.json` and `fixtures/your-artifact/` are gitignored — they won't
be committed even though they may hold client data.

### 4. Build

```
npm run preview -- --fixture fixtures/your-job.json
```

This writes `out/receipt.html` (safe), `out/receipt.json`, and
`vault/receipt.local.html` (secrets). It prints the verification result — all
lines should read PASS.

If it prints `BUILD BLOCKED — field … rejected`, a public field broke a rule
(e.g. category too long, a non-enum kind). Fix that field and rerun. Nothing is
written when blocked.

### 5. Check the redaction yourself

```
open vault/receipt.local.html
```

Left column = raw (secrets). Right column = what will be published. Confirm the
right side is genuinely secret-free and still meaningful. The bottom lists every
secret that was stripped (by location, not value).

### 6. Show makers the safe version

```
open out/receipt.html
```

Show **this** to ~10 people who do AI-assisted web work. Ask one question:

> これ、あなたの案件でも「受注に使える資産」になりますか?
> それとも、顧客の秘密を消したら空っぽですか? どこが残れば価値で、どこを消したら意味がなくなりますか?

Record: would-use (yes/no), and *which fields* they said carry the value.

### 7. Decide

- **≥6/10 would use it** → the redacted receipt is a real asset. Proceed to build
  the credential pipeline (Phase 1).
- **<6/10**, or "empty once redacted" dominates → web-production is the wrong
  beachhead. Move the beachhead to a domain where the transferable value survives
  redaction (higher procedure-density, machine-checkable), or reconsider the wedge.

## Verifying independently (optional, to show a skeptic)

Anyone with `out/receipt.json`, the artifact, and your verifier public key can
re-check every machine claim and the signature:

```
npm run verify:receipt -- --receipt out/receipt.json --artifact fixtures/your-artifact/index.html
```

The verifier key lives in `vault/verifier-key.json` (its public half is the trust
anchor). A third party would be handed that public key out of band.
