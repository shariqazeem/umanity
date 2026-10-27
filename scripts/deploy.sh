#!/bin/bash
# Deployment helper script for Ubuntu server

set -e

echo "🚀 Umanity Solana Deployment Script"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if .env.local exists
if [ ! -f .env.local ]; then
    print_error ".env.local file not found!"
    print_info "Please create .env.local with your environment variables"
    exit 1
fi

print_success ".env.local found"

# Pull latest changes
print_info "Pulling latest changes from git..."
git pull origin main
print_success "Code updated"

# Build and start containers
print_info "Building and starting Docker containers..."
docker compose down
docker compose up -d --build

print_success "Containers started"

# Wait for app to be ready
print_info "Waiting for application to be ready..."
sleep 10

# Check container status
print_info "Checking container status..."
docker compose ps

# Check logs for errors
print_info "Recent logs:"
docker compose logs --tail=20 app

print_success "Deployment complete!"
print_info "Visit https://umanity.xyz to see your app"
