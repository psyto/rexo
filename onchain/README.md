# Rexo — ERC-8004 re-execution validator (PoC)

Proves that Rexo plugs into the **ERC-8004 Validation Registry** as an
independent **re-execution** validator — the white space the deep-research found
empty (deployed Validation is all TEE/ZK "who/where" attestation; nobody
re-computes the deliverable's quality).

## What it does

The full ERC-8004 flow, end to end:

1. `IdentityRegistry.registerAgent(agentKeyHash, uri)` — the agent's identity (a key hash).
2. `ValidationRegistry.validationRequest(validator, agentId, requestURI, requestHash)` — the operator asks Rexo to validate a job.
3. `ValidationRegistry.validationResponse(requestHash, response, responseURI, responseHash, tag)` — **Rexo, the named validator, posts the re-computed result on-chain.**
4. `getValidationStatus(requestHash)` — anyone reads it back.

The response fields carry the **held-out correctness tier**, not a bare pass/fail —
re-running an agent's *own* tests is self-graded (an empirical study found ~28.4% of
tests-passing patches are actually wrong; UTBoost, ACL 2025), so Rexo also runs an
**independent held-out suite** and encodes the tier:

| tier | response | tag | responseHash (reproducible) |
|---|---|---|---|
| `held-out-verified` (committed 4/4 + held-out 4/4) | `100` | `held-out-verified` | `0x32d758f6…711f220` |
| `held-out-FAILED` (own tests pass, held-out catches — the ~28%) | `0` | `held-out-FAILED` | `0xee80a0a3…01902d2e` |

`test/ValidationFlow.t.sol` proves both on-chain: the verified patch records `100`,
and a wrong-but-passing patch records `0` — the chain can't launder a bad
deliverable into a green score. On-chain carries only the commitment + score + tag;
the full verified Receipt lives off-chain at `responseURI`.

Regenerate the hashes/tags (re-runs the real held-out suites):
```
(cd ../onchain-svm && node scripts/compute-tier.mjs ../fixtures/reckn-r1-heldout)
(cd ../onchain-svm && node scripts/compute-tier.mjs ../fixtures/swe-heldout-catch)
```

## Run

Offline (deterministic, free):
```
cd onchain && forge test -vv
```

Broadcast to a public testnet (real txs + explorer links). The broadcaster acts
as both agent operator and validator for this single-key demo:
```
cd onchain
forge script script/PostValidation.s.sol \
  --rpc-url <TESTNET_RPC> --private-key <FUNDED_KEY> --broadcast
```

## Honest scope

- The ERC-8004 Validation Registry is "under active revision" and had no
  confirmed mainnet deployment as of mid-2026; this is a minimal faithful
  reference of the interface, not the canonical contract.
- The standard provides no staking/slashing; the validator here is a trusted
  address. Crypto-economic honesty (bonded re-execution / an AVS) is a separate
  layer, deliberately out of ERC-8004's scope.
- This proves the *integration* is real and cheap; it does not prove demand —
  who requests and pays for a `validationResponse` is the open question.
