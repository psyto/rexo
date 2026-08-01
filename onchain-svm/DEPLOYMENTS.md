# Live deployment — Solana devnet

Context Capital's SVM re-execution validator, live on Solana **devnet** (2026-08-01).
Real, third-party-verifiable evidence that the cross-VM re-execution validator
exists on-chain — not just in tests.

## Programs

| Program | Address | Explorer |
|---|---|---|
| Validation record program | `BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE` | https://explorer.solana.com/address/BChTzGr4x4Gvm2svavb2zXZjiaWZ2e65yAqoJB6F3bBE?cluster=devnet |
| Vault deliverable (demo) | `4buUxq7Lm9Y62q5ST8ec6ZXwA2RacxEEFFjdgTAJk3FK` | https://explorer.solana.com/address/4buUxq7Lm9Y62q5ST8ec6ZXwA2RacxEEFFjdgTAJk3FK?cluster=devnet |

## validationResponse recorded on-chain

The validator posted a validation record whose `responseHash` is a **real Context
Capital re-execution commitment** (the reckn-R1 verified receipt).

| Field | Value |
|---|---|
| tx | `1BwqHbCk3UJfXenTkGENWMHvNtkN2NeRVf8KFzzGpwaPZa5DLT1CfGVZTghnufv2jZ7AnshgoFCUodjRPfKTvAT` |
| record account | `DJj8wgodMzvjF6PC4FNBChkM5y28JT4n556oCW5gxgtb` (owned by the Validation program) |
| response | `100` (passed) |
| responseHash | `b61a40402fa247ff4b8890c9a8c0fff19afffe0e6f5380baa822d63a9ef753a9` |
| tx explorer | https://explorer.solana.com/tx/1BwqHbCk3UJfXenTkGENWMHvNtkN2NeRVf8KFzzGpwaPZa5DLT1CfGVZTghnufv2jZ7AnshgoFCUodjRPfKTvAT?cluster=devnet |
| record explorer | https://explorer.solana.com/address/DJj8wgodMzvjF6PC4FNBChkM5y28JT4n556oCW5gxgtb?cluster=devnet |

## Reproduce

```
# deploy (needs a funded devnet keypair)
KEYPAIR=<funded> URL=<devnet rpc> bash onchain-svm/scripts/deploy-devnet.sh

# post a validationResponse
RPC=<devnet rpc> PROGRAM_ID=<validation program id> KEYPAIR=<funded> \
  node onchain-svm/scripts/post-validation-devnet.mjs
```

The deployer keypair and RPC key are device-local (never committed). EVM testnet
broadcast (Base Sepolia) is `cd onchain && forge script script/PostValidation.s.sol
--rpc-url <rpc> --private-key <funded> --broadcast`.
