#!/usr/bin/env bash
# Runs the program v3 tests against a fresh local validator that has
# Meteora's bonding curve and Metaplex cloned from mainnet, and Umanity v3
# loaded as an upgradeable program owned by the test wallet.
#
#   bash scripts/test-programs.sh
#
# Env: ANCHOR_WALLET (default ~/.config/solana/devnet.json), LEDGER_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."

WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/devnet.json}"
LEDGER="${LEDGER_DIR:-${TMPDIR:-/tmp}/umanity-test-ledger}"
PROGRAM_ID="UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3"

anchor build >/dev/null

solana-test-validator --reset --quiet --ledger "$LEDGER" \
  --mint "$(solana-keygen pubkey "$WALLET")" \
  --url https://api.mainnet-beta.solana.com \
  --clone-upgradeable-program dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN \
  --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  --upgradeable-program "$PROGRAM_ID" target/deploy/umanity.so "$WALLET" &
VALIDATOR=$!
trap 'kill $VALIDATOR 2>/dev/null || true' EXIT

until solana cluster-version --url http://127.0.0.1:8899 >/dev/null 2>&1; do sleep 1; done

ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET="$WALLET" \
  npx tsx --test --test-concurrency=1 tests/umanity.test.ts
