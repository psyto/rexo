# Rexo — ERC-8004 re-execution validator (PoC)

Proves that Rexo plugs into the **ERC-8004 Validation Registry** as an
independent **re-execution** validator — the white space the deep-research found
empty (deployed Validation is all TEE/ZK "who/where" attestation; nobody
re-computes the deliverable's quality).

## What it does

The full ERC-8004 flow, end to end:

1. `IdentityRegistry.registerAgent(agentKeyHash, uri)` — the agent's identity (a key hash).
2. `ValidationRegistry.validationRequest(validator, agentId, requestURI, requestHash)` — the operator asks Rexo to validate a job.
3. `ValidationRegistry.validationResponse(requestHash, 100, responseURI, responseHash, "reexec")` — **Rexo, the named validator, posts the re-computed result on-chain.**
4. `getValidationStatus(requestHash)` — anyone reads it back.

The on-chain **`responseHash` is the real reckn-R1 verified-receipt commitment**
`0xb61a40402fa247ff4b8890c9a8c0fff19afffe0e6f5380baa822d63a9ef753a9` — i.e. the
independent re-execution result (target regression passes, 4/4, 0 regressions)
that Rexo produced from `fixtures/reckn-r1-bundle`. On-chain carries
only the commitment + a 0–100 score; the full verified Receipt lives off-chain at
`responseURI`.

Regenerate the hash:
```
npx tsx -e "import('./src/verify/recompute.js').then(m=>console.log('0x'+m.recompute('swe','fixtures/reckn-r1-bundle').commitment))"
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
