#!/usr/bin/env bash
# Deploys and sets up the Umanity program, in the order mainnet uses. Each step is
# skipped when it is already done, so the script can be run again after a failure.
#
#   OPS=<your wallet> bash scripts/mainnet-deploy.sh                    # mainnet (RPC from mainnet.env)
#   OPS=<pubkey> RPC=http://127.0.0.1:8899 bash scripts/mainnet-deploy.sh # rehearsal on a local validator
#
# Keys live outside the repo, in ~/.config/umanity/mainnet (UMANITY_KEYS):
#   deployer.json  upgrade authority; pays the program's rent and gets it back on close
#   server.json    admin (creates drops, posts proof) and release key, until the NEAR guard takes over
#   treasury.json  pays network fees for gifts; receives Aurora and x402 gifts before they go into pots
# and the program's own key in ~/.config/solana/umanity-program.json (PROGRAM_KEY).
#
# Steps:
#   1. deploy the program, with the deployer as upgrade authority
#   2. fund the server and the treasury from the deployer
#   3. init_config: the program requires its upgrade authority as the first admin;
#      release key = server, ops = OPS, pots capped at MAX_POT, review REVIEW_HOURS
#   4. set_admin(server), so the deployer key can stay offline
#   5. open the USDC accounts of the treasury and ops
set -euo pipefail
cd "$(dirname "$0")/.."

D="${UMANITY_KEYS:-$HOME/.config/umanity/mainnet}"
PROGRAM_KEY="${PROGRAM_KEY:-$HOME/.config/solana/umanity-program.json}"
SO=target/deploy/umanity.so
if [ -z "${RPC:-}" ]; then
  set -a; source "$D/mainnet.env"; set +a
  RPC="$SOLANA_RPC_URL"
fi
: "${OPS:?set OPS: the wallet that receives ops half of every fee}"
MAX_POT="${MAX_POT:-2000}"
REVIEW_HOURS="${REVIEW_HOURS:-6}"
SERVER_SOL="${SERVER_SOL:-0.03}"
TREASURY_SOL="${TREASURY_SOL:-0.06}"
CU_PRICE="${CU_PRICE:-20000}"

DEPLOYER=$(solana-keygen pubkey "$D/deployer.json")
SERVER=$(solana-keygen pubkey "$D/server.json")
TREASURY=$(solana-keygen pubkey "$D/treasury.json")
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEY")
S=(--url "$RPC" --keypair "$D/deployer.json" --commitment confirmed)
balance() { solana balance "$1" --url "$RPC" --lamports | awk '{print $1}'; }

echo "program $PROGRAM_ID · deployer $DEPLOYER · server $SERVER · treasury $TREASURY · ops $OPS"
echo "deployer holds $(solana balance "$DEPLOYER" --url "$RPC")"

# 1. The program
if solana program show "$PROGRAM_ID" --url "$RPC" >/dev/null 2>&1; then
  echo "1. program already deployed"
else
  echo "1. deploying $(stat -f%z "$SO") bytes (rent $(solana rent "$(( $(stat -f%z "$SO") + 45 ))" --url "$RPC" | awk '/Rent-exempt/{print $3}') SOL)"
  # A buffer key on disk means a failed deploy resumes where it stopped (run the script again),
  # and its rent can always be taken back with `solana program close <buffer>`.
  BUFFER_KEY="${BUFFER_KEY:-$D/buffer.json}"
  [ -f "$BUFFER_KEY" ] || { solana-keygen new --no-bip39-passphrase --silent --outfile "$BUFFER_KEY" >/dev/null; chmod 600 "$BUFFER_KEY"; }
  solana program deploy "$SO" "${S[@]}" --program-id "$PROGRAM_KEY" --upgrade-authority "$D/deployer.json" \
    --buffer "$BUFFER_KEY" --max-len "$(stat -f%z "$SO")" --with-compute-unit-price "$CU_PRICE" ${DEPLOY_FLAGS:-}
fi
solana program show "$PROGRAM_ID" --url "$RPC" | grep -E "Authority|Data Length|Balance"

# 2. Running money for the server and the treasury
fund() {
  local to=$1 sol=$2 want have
  want=$(python3 -c "print(int($sol * 1e9))")
  have=$(balance "$to")
  if [ "$have" -ge "$want" ]; then echo "2. $to has $have lamports"; return; fi
  solana transfer "$to" "$(python3 -c "print(($want - $have) / 1e9)")" "${S[@]}" --from "$D/deployer.json" --allow-unfunded-recipient --with-compute-unit-price "$CU_PRICE" >/dev/null
  echo "2. funded $to to $sol SOL"
}
fund "$SERVER" "$SERVER_SOL"
fund "$TREASURY" "$TREASURY_SOL"

# 3–5. Config, admin hand-over, USDC accounts (scripts/umanity-setup.ts, signed by the right key)
setup() { NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta SOLANA_RPC_URL="$RPC" UMANITY_AUTHORITY_KEYPAIR_PATH="$1" npx tsx scripts/umanity-setup.ts "${@:2}"; }
status=$(setup "$D/server.json" status)
if echo "$status" | grep -q "not initialised"; then
  setup "$D/deployer.json" init --ops "$OPS" --release "$SERVER" --max-pot "$MAX_POT" --review-hours "$REVIEW_HOURS"
  status=$(setup "$D/server.json" status)
else
  echo "3. config already initialised"
fi
if echo "$status" | grep -q "admin: '$SERVER'"; then
  echo "4. server is already admin"
else
  setup "$D/deployer.json" set-admin "$SERVER"
fi
setup "$D/server.json" accounts --treasury "$TREASURY" --ops "$OPS"
setup "$D/server.json" status
echo "deployer keeps $(solana balance "$DEPLOYER" --url "$RPC")"
