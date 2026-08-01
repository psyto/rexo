#!/usr/bin/env bash
# Deploy the Context Capital SVM re-execution validator programs to Solana devnet.
#
# Prereqs: a FUNDED devnet keypair. Fund it either with
#   solana airdrop 2 <pubkey> --url devnet         (often rate-limited)
# or the web faucet https://faucet.solana.com (paste the pubkey).
#
# Usage:
#   KEYPAIR=~/.config/solana/id.json bash onchain-svm/scripts/deploy-devnet.sh
set -euo pipefail

KEYPAIR="${KEYPAIR:-$HOME/.config/solana/id.json}"
URL="${URL:-https://api.devnet.solana.com}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "deployer : $(solana-keygen pubkey "$KEYPAIR")"
echo "balance  : $(solana balance "$KEYPAIR" --url "$URL")"

echo "== build (BPF) =="
( cd "$DIR/program" && cargo build-sbf )
( cd "$DIR/deliverable" && cargo build-sbf )

echo "== deploy: Validation record program =="
solana program deploy "$DIR/program/target/deploy/cc_svm_validation_program.so" \
  --url "$URL" --keypair "$KEYPAIR"

echo "== deploy: vault deliverable =="
solana program deploy "$DIR/deliverable/target/deploy/cc_svm_vault_deliverable.so" \
  --url "$URL" --keypair "$KEYPAIR"

echo
echo "Explorer (replace <PROGRAM_ID> with the printed Program Id):"
echo "  https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet"
