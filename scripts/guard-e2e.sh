#!/usr/bin/env bash
# A guarded release end to end (see scripts/guard-e2e.ts): a fresh local
# validator with Umanity v3 loaded, the NEAR testnet guard and NEAR's testnet
# MPC network.
#
#   bash scripts/guard-e2e.sh
#
# Env: ANCHOR_WALLET (default ~/.config/solana/devnet.json), LEDGER_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."

WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/devnet.json}"
LEDGER="${LEDGER_DIR:-${TMPDIR:-/tmp}/umanity-guard-e2e-ledger}"
PROGRAM_ID="UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3"

[ -f target/deploy/umanity.so ] || anchor build >/dev/null

solana-test-validator --reset --quiet --ledger "$LEDGER" \
  --mint "$(solana-keygen pubkey "$WALLET")" \
  --upgradeable-program "$PROGRAM_ID" target/deploy/umanity.so "$WALLET" &
VALIDATOR=$!
trap 'kill $VALIDATOR 2>/dev/null || true' EXIT

until solana cluster-version --url http://127.0.0.1:8899 >/dev/null 2>&1; do sleep 1; done

ANCHOR_WALLET="$WALLET" npx tsx scripts/guard-e2e.ts
