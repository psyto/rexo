# Live deployment — Solana devnet

Rexo's SVM re-execution validator, live on Solana **devnet** (2026-08-01).
Real, third-party-verifiable evidence that the cross-VM re-execution validator
exists on-chain — not just in tests.

## Programs

| Program | Address | Explorer |
|---|---|---|
| Validation record program | `BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE` | https://explorer.solana.com/address/BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE?cluster=devnet |
| Vault deliverable (demo) | `4buUxq7Lm9Y62q5ST8ec6ZXwA2RacxEEFFjdgTAJk3FK` | https://explorer.solana.com/address/4buUxq7Lm9Y62q5ST8ec6ZXwA2RacxEEFFjdgTAJk3FK?cluster=devnet |

## validationResponse recorded on-chain — held-out correctness TIER

The validator posts the **held-out correctness tier** on-chain via the standard
fields (`response` 0–100 = assurance the tier deserves, `tag` = tier label,
`responseHash` = reproducible commitment to the re-execution facts). The tier is
derived by re-running the committed suite **and an independent held-out suite** —
regenerate any row with `node scripts/compute-tier.mjs <bundle-dir>`.

**held-out-verified** — reckn-R1 fix passed committed 4/4 **and** an independent
held-out suite 4/4 (2026-08-02):

| Field | Value |
|---|---|
| tx | `3gbqrpxxHtCgxk2D6RJkkXaLEw5j9btiUgovP1yqDRBe1CCQm2HWGbisgSHNUCA6JB26tEs8NeAihCWmjJ22ti71` |
| record account | `Ebqsseoy4oCx2DQopDujsjWREHXc6wjUhUPDApiJ8rsp` (owned by the Validation program) |
| response | `100` |
| tag | `held-out-verified` |
| responseHash | `32d758f63d8f84b55b3c9835a52d17341860f288e82f9535c23c4be67711f220` |
| tx explorer | https://explorer.solana.com/tx/3gbqrpxxHtCgxk2D6RJkkXaLEw5j9btiUgovP1yqDRBe1CCQm2HWGbisgSHNUCA6JB26tEs8NeAihCWmjJ22ti71?cluster=devnet |
| record explorer | https://explorer.solana.com/address/Ebqsseoy4oCx2DQopDujsjWREHXc6wjUhUPDApiJ8rsp?cluster=devnet |

Read the record back (owner = Validation program, response 100, tag
`held-out-verified`, responseHash above) — the tier is on-chain, not just claimed.

Earlier record (2026-08-01), committed-only re-execution commitment, kept for
history: tx `1Bwq…TvAT`, record `DJj8…xgtb`, `response=100`,
`responseHash=b61a…53a9`.

## Reproduce

```
# deploy (needs a funded devnet keypair)
KEYPAIR=<funded> URL=<devnet rpc> bash onchain-svm/scripts/deploy-devnet.sh

# derive the tier fields (response/tag/responseHash) from a real held-out re-run
node onchain-svm/scripts/compute-tier.mjs fixtures/reckn-r1-heldout

# post the tier as a validationResponse (FIXTURE selects the bundle)
RPC=<devnet rpc> PROGRAM_ID=<validation program id> KEYPAIR=<funded> \
  FIXTURE=../fixtures/reckn-r1-heldout \
  node onchain-svm/scripts/post-validation-devnet.mjs
```

The deployer keypair and RPC key are device-local (never committed). EVM testnet
broadcast (Base Sepolia) is `cd onchain && forge script script/PostValidation.s.sol
--rpc-url <rpc> --private-key <funded> --broadcast`.
