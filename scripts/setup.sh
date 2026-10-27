#!/bin/bash

echo "🚀 Setting up Umanity Solana Project..."
echo ""

# Check if required tools are installed
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        echo "   Visit: $2"
        exit 1
    else
        echo "✅ $1 is installed"
    fi
}

echo "Checking prerequisites..."
check_tool "node" "https://nodejs.org/"
check_tool "npm" "https://nodejs.org/"
check_tool "solana" "https://docs.solana.com/cli/install-solana-cli-tools"
check_tool "anchor" "https://book.anchor-lang.com/getting_started/installation.html"

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Setting Solana to devnet..."
solana config set --url devnet

echo ""
echo "Checking Solana wallet..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "⚠️  No Solana wallet found. Creating one..."
    solana-keygen new --outfile ~/.config/solana/id.json
fi

echo ""
echo "Checking SOL balance..."
BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "💰 Requesting airdrop..."
    solana airdrop 2
fi

echo ""
echo "Building Solana programs..."
anchor build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy programs: anchor deploy --provider.cluster devnet"
echo "2. Update program IDs in lib.rs files"
echo "3. Run frontend: npm run dev"
echo ""
echo "Happy building! 🎉"
