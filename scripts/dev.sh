#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Starting WXT dev server (Chrome)..."
pnpm dev
